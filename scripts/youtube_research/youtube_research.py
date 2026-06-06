import asyncio
import json
import os
import subprocess
import sys
import datetime
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree as ET

CHANNELS = [
    "@GreenCandle",
    "@Bitcoin_University",
    "@SimonDixon21",
    "@exitmanual",
    "@ScottMelker",
    "@RobinSeyr",
    "@1MarkMoss",
    "@SimplyBitcoin",
    "@LukeMikic21",
    "@Swan_Bitcoin",
    "@JoeConsorti",
]

# Fetch the N most recent videos per channel.
# These Bitcoin channels post 1-2x/week, so 5 covers the last 7 days.
# Flat-playlist is fast (~1s/channel) and avoids YouTube bot detection.
VIDEOS_PER_CHANNEL = 5
YT_DLP = "/usr/local/lib/hermes-agent/venv/bin/yt-dlp"

# Delivery config — chat_id sourced from environment.
_TELEGRAM_CHAT_ID = int(os.getenv("TELEGRAM_USER_CHAT_ID", "0"))

_RSS_NS = {
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
    "atom": "http://www.w3.org/2005/Atom",
}


def get_recent_videos(handle):
    """Return (entries, channel_id) via flat-playlist."""
    url = f"https://www.youtube.com/{handle}/videos"
    command = [
        YT_DLP, "--flat-playlist",
        "--playlist-end", str(VIDEOS_PER_CHANNEL),
        "-J", "--quiet", url,
    ]
    try:
        result = subprocess.run(
            command, capture_output=True, text=True, check=True, timeout=30
        )
        data = json.loads(result.stdout)
        entries = [e for e in data.get("entries", []) if e]
        # channel_id may be at top level or in the first entry
        channel_id = data.get("channel_id") or (
            entries[0].get("playlist_channel_id") if entries else None
        )
        if channel_id and not channel_id.startswith("UC"):
            channel_id = "UC" + channel_id
        return entries, channel_id
    except Exception as e:
        print(f"Error fetching {handle}: {e}", file=sys.stderr)
        return [], None


def get_rss_data(channel_id):
    """Return {video_id: {views, description, thumbnail}} from YouTube RSS."""
    feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    try:
        req = urllib.request.Request(feed_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read()
        root = ET.fromstring(content)
        result = {}
        for entry in root.findall("atom:entry", _RSS_NS):
            vid_el = entry.find("yt:videoId", _RSS_NS)
            if vid_el is None:
                continue
            vid = vid_el.text
            mg = entry.find("media:group", _RSS_NS)
            if mg is None:
                continue
            desc_el = mg.find("media:description", _RSS_NS)
            thumb_el = mg.find("media:thumbnail", _RSS_NS)
            community = mg.find("media:community", _RSS_NS)
            stats_el = (
                community.find("media:statistics", _RSS_NS)
                if community is not None
                else None
            )
            result[vid] = {
                "description": (desc_el.text or "").strip() if desc_el is not None else "",
                "thumbnail": thumb_el.get("url", "") if thumb_el is not None else "",
                "views": int(stats_el.get("views", 0)) if stats_el is not None else 0,
            }
        return result
    except Exception as e:
        print(f"RSS error for {channel_id}: {e}", file=sys.stderr)
        return {}


def _video_id(entry):
    """Extract YouTube video ID from a flat-playlist entry."""
    vid = entry.get("id")
    if vid:
        return vid
    url = entry.get("url", "")
    qs = parse_qs(urlparse(url).query)
    return qs.get("v", [""])[0]


def _format_views(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n) if n > 0 else "N/A"


def _first_paragraph(text, max_chars=250):
    """Return the first non-empty paragraph, trimmed to max_chars."""
    for para in text.split("\n\n"):
        para = para.strip()
        if para:
            if len(para) > max_chars:
                return para[:max_chars].rstrip() + "…"
            return para
    return ""


def _build_caption(handle, title, views, description, video_url):
    view_str = _format_views(views)
    short_desc = _first_paragraph(description)
    parts = [f"{handle}", title, f"Views: {view_str}"]
    if short_desc:
        parts.append(short_desc)
    parts.append(video_url)
    caption = "\n\n".join(parts)
    if len(caption) > 1024:
        caption = caption[:1021] + "…"
    return caption


async def send_report(channel_results):
    filepath = _generate_and_save_report(channel_results)
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        print("TELEGRAM_BOT_TOKEN not available. Report will be printed to stdout.", file=sys.stderr)
        # Fallback to printing the report to stdout
        with open(filepath, 'r', encoding='utf-8') as f:
            print(f.read())
        print(f"\n*Report saved to {filepath}*")
        return

    try:
        from telegram import Bot
        from telegram.error import TelegramError
    except ImportError as e:
        print(f"python-telegram-bot unavailable: {e}", file=sys.stderr)
        with open(filepath, 'r', encoding='utf-8') as f:
            print(f.read())
        print(f"\n*Report saved to {filepath}*")
        return

    bot = Bot(token=token)

    total = sum(len(v) for v in channel_results.values())
    if total == 0:
        print("No new videos found, not sending report.")
        # Optionally send a message saying nothing was found
        # await bot.send_message(chat_id=_TELEGRAM_CHAT_ID, text="No new videos found in the weekly YouTube digest.")
        return

    try:
        with open(filepath, 'rb') as doc:
            await bot.send_document(
                chat_id=_TELEGRAM_CHAT_ID,
                document=doc,
                caption="Here is your weekly YouTube research report.",
                filename=os.path.basename(filepath)
            )
        print(f"Report sent to Telegram and saved to {filepath}")
    except TelegramError as e:
        print(f"Failed to send report as document: {e}. Falling back to text message.", file=sys.stderr)
        with open(filepath, 'r', encoding='utf-8') as f:
            full_report = f.read()
        
        # Split into chunks of 4000 characters to be safe for Telegram's message limit
        chunks = [full_report[i:i+4000] for i in range(0, len(full_report), 4000)]
        for i, chunk in enumerate(chunks):
            header = f"**Bitcoin YouTube Digest (Part {i+1}/{len(chunks)})**\n\n" if len(chunks) > 1 else "**Bitcoin YouTube Digest**\n\n"
            try:
                await bot.send_message(chat_id=_TELEGRAM_CHAT_ID, text=header + chunk, parse_mode='Markdown')
            except TelegramError as send_err:
                 print(f"Failed to send text chunk {i+1}: {send_err}", file=sys.stderr)
        print(f"Report sent as text to Telegram and saved to {filepath}")


def _generate_and_save_report(channel_results):
    """Generate a markdown-formatted report, save it to a file, and return the path."""
    reports_dir = "/root/.hermes/agents/youtube-research-agent/reports"
    os.makedirs(reports_dir, exist_ok=True)
    date_str = datetime.datetime.now().strftime("%Y%m%d")
    filepath = f"{reports_dir}/youtube_research_{date_str}.md"
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("## Bitcoin YouTube Digest — Latest Videos This Week\n\n")
        for handle, videos in channel_results.items():
            if not videos:
                continue
            for v in videos:
                title = v.get("title", "No Title")
                views = _format_views(v.get("views", 0))
                url = v.get("url", "")
                description = v.get("description", "")
                f.write(f"- **Channel:** {handle}\n")
                f.write(f"- **Title:** {title}\n")
                f.write(f"- **Link:** {url}\n")
                f.write(f"- **Views:** {views}\n")
                if description:
                    f.write(f"- **Description:** {description.strip()}\n")
                f.write("\n---\n\n")
    return filepath


def _print_text_report(channel_results):
    """DEPRECATED: This function is kept for cronjobs that don't have Telegram token. It now saves file and prints content to stdout."""
    filepath = _generate_and_save_report(channel_results)
    with open(filepath, "r", encoding="utf-8") as f:
        print(f.read())
    print(f"\n*Report saved to {filepath}*")


def main():
    channel_results = {h: [] for h in CHANNELS}
    channel_ids = {}

    # Phase 1: fetch video lists concurrently
    with ThreadPoolExecutor(max_workers=len(CHANNELS)) as executor:
        futures = {executor.submit(get_recent_videos, h): h for h in CHANNELS}
        for future in as_completed(futures):
            handle = futures[future]
            entries, channel_id = future.result()
            channel_results[handle] = entries
            if channel_id:
                channel_ids[handle] = channel_id

    # Phase 2: fetch RSS feeds concurrently (view counts, descriptions, clean thumbnails)
    rss_by_channel = {}
    if channel_ids:
        with ThreadPoolExecutor(max_workers=len(channel_ids)) as executor:
            futures = {
                executor.submit(get_rss_data, cid): handle
                for handle, cid in channel_ids.items()
            }
            for future in as_completed(futures):
                handle = futures[future]
                rss_by_channel[handle] = future.result()

    # Phase 3: merge RSS metadata into video entries
    for handle, videos in channel_results.items():
        rss = rss_by_channel.get(handle, {})
        for v in videos:
            vid = _video_id(v)
            if vid and vid in rss:
                v.update(rss[vid])

    # Phase 4: deliver (sends photos directly via Telegram; outputs nothing on success)
    asyncio.run(send_report(channel_results))


if __name__ == "__main__":
    main()
