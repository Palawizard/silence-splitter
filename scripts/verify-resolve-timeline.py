#!/usr/bin/env python3
"""Validate a generated XMEML file and optionally the current Resolve timeline."""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlparse
import xml.etree.ElementTree as ET


class Verification:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def check(self, condition: bool, message: str) -> None:
        status = "PASS" if condition else "FAIL"
        print(f"{status}  {message}")
        if not condition:
            self.failures.append(message)


def as_list(element: ET.Element | None, path: str) -> list[ET.Element]:
    return [] if element is None else element.findall(path)


def text_int(element: ET.Element, name: str) -> int:
    value = element.findtext(name)
    if value is None:
        raise ValueError(f"Missing <{name}> in clip item")
    return int(value)


def timing(item: ET.Element) -> tuple[int, int, int, int]:
    return (
        text_int(item, "start"),
        text_int(item, "end"),
        text_int(item, "in"),
        text_int(item, "out"),
    )


def file_url_to_path(value: str) -> Path:
    parsed = urlparse(value)
    if parsed.scheme != "file":
        raise ValueError(f"Unsupported media URL: {value}")

    decoded = unquote(parsed.path)
    if os.name == "nt" and re.match(r"^/[A-Za-z]:/", decoded):
        decoded = decoded[1:]
    if parsed.netloc and parsed.netloc != "localhost":
        decoded = f"//{parsed.netloc}/{decoded.lstrip('/')}"
    return Path(decoded)


def probe_audio_streams(media_path: Path) -> list[dict[str, object]]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=index,channels,duration",
            "-of",
            "json",
            str(media_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    streams = json.loads(result.stdout).get("streams", [])
    return streams


def probe_media_duration(media_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(media_path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return float(result.stdout.strip())


def javascript_round(value: float) -> int:
    return math.floor(value + 0.5)


def decoded_audio_hash(media_path: Path, map_specifier: str) -> str:
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(media_path),
            "-map",
            map_specifier,
            "-t",
            "5",
            "-c:a",
            "pcm_s16le",
            "-f",
            "hash",
            "-hash",
            "md5",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout.strip()


def validate_xml(xml_path: Path, verification: Verification) -> dict[str, object]:
    root = ET.parse(xml_path).getroot()
    sequence = root.find("sequence")
    if sequence is None:
        raise ValueError("The XML does not contain a sequence")

    video_tracks = as_list(sequence, "./media/video/track")
    video_items = as_list(video_tracks[0] if video_tracks else None, "clipitem")
    audio_tracks = as_list(sequence, "./media/audio/track")
    path_url = sequence.findtext("./media/video/track/clipitem/file/pathurl")
    if not path_url:
        raise ValueError("The XML does not contain a source media path")

    media_path = file_url_to_path(path_url)
    audio_streams = probe_audio_streams(media_path)
    channels_per_stream = [int(stream.get("channels", 0)) for stream in audio_streams]
    expected_audio_tracks = sum(channels_per_stream)
    expected_track_sources = [
        (stream_index, channel_index)
        for stream_index, channel_count in enumerate(channels_per_stream, start=1)
        for channel_index in range(1, channel_count + 1)
    ]
    file_paths_by_id = {
        file_element.attrib["id"]: file_url_to_path(file_element.findtext("pathurl", ""))
        for file_element in sequence.findall(".//file")
        if file_element.attrib.get("id") and file_element.findtext("pathurl")
    }
    timebase = int(sequence.findtext("./rate/timebase", "0"))
    ntsc = sequence.findtext("./rate/ntsc", "FALSE") == "TRUE"
    frame_rate = timebase * (1000 / 1001 if ntsc else 1)
    media_duration = probe_media_duration(media_path)
    expected_source_offsets = [
        javascript_round(
            -round(float(stream.get("duration", media_duration)) - media_duration, 3)
            * frame_rate
        )
        for stream in audio_streams
    ]

    verification.check(media_path.is_file(), f"source media exists: {media_path}")
    verification.check(len(video_tracks) == 1, "XML contains exactly one video track")
    verification.check(len(video_items) > 0, "XML contains video clip items")
    verification.check(
        len(audio_tracks) == expected_audio_tracks,
        f"XML contains {expected_audio_tracks} audio channel tracks "
        f"({channels_per_stream} channels per stream)",
    )
    video_timings = [timing(item) for item in video_items]
    source_track_indices: list[int] = []
    sidecar_paths: list[Path] = []
    verified_sidecar_streams: set[int] = set()
    audio_timings: list[list[tuple[int, int, int, int]]] = []
    for track_index, track in enumerate(audio_tracks, start=1):
        stream_order, channel_index = expected_track_sources[track_index - 1]
        items = as_list(track, "clipitem")
        track_timings = [timing(item) for item in items]
        audio_timings.append(track_timings)
        source_offset = expected_source_offsets[stream_order - 1]
        verification.check(
            len(track_timings) == len(video_timings)
            and all(
                audio_start == video_start
                and audio_end == video_end
                and audio_in == video_in + source_offset
                and audio_out == video_out + source_offset
                for (audio_start, audio_end, audio_in, audio_out),
                    (video_start, video_end, video_in, video_out)
                in zip(track_timings, video_timings)
            ),
            f"XML audio track {track_index} applies its {source_offset:+d}-frame analysis alignment",
        )
        indices = {
            text_int(source_track, "trackindex")
            for item in items
            if (source_track := item.find("sourcetrack")) is not None
        }
        verification.check(
            indices == {channel_index},
            f"XML audio track {track_index} maps sidecar channel {channel_index}",
        )
        expected_output = channel_index if channels_per_stream[stream_order - 1] == 2 else None
        actual_output = track.findtext("outputchannelindex")
        verification.check(
            actual_output == (str(expected_output) if expected_output is not None else None),
            f"XML audio track {track_index} has correct stereo output routing",
        )
        expected_pan = -1 if channel_index == 1 else 1
        pan_values = {
            float(parameter.findtext("value", "0"))
            for item in items
            for effect in item.findall("filter/effect")
            if effect.findtext("effectid") == "audiopan"
            for parameter in effect.findall("parameter")
            if parameter.findtext("parameterid") == "pan"
        }
        verification.check(
            pan_values == ({expected_pan} if expected_output is not None else set()),
            f"XML audio track {track_index} pans its stereo channel correctly",
        )
        source_track_indices.extend(indices)

        first_file = track.find("clipitem/file")
        file_id = first_file.attrib.get("id") if first_file is not None else None
        sidecar_path = file_paths_by_id.get(file_id or "")
        if sidecar_path is None:
            verification.check(False, f"XML audio track {track_index} has a sidecar path")
            continue
        sidecar_paths.append(sidecar_path)
        sidecar_channels = (
            [int(stream.get("channels", 0)) for stream in probe_audio_streams(sidecar_path)]
            if sidecar_path.is_file() else []
        )
        expected_channels = channels_per_stream[stream_order - 1]
        verification.check(
            sidecar_path.is_file(),
            f"audio sidecar {stream_order} exists: {sidecar_path}",
        )
        verification.check(
            sidecar_channels == [expected_channels],
            f"audio sidecar {stream_order} contains one {expected_channels}-channel stream",
        )
        if sidecar_path.is_file() and stream_order not in verified_sidecar_streams:
            verification.check(
                decoded_audio_hash(media_path, f"0:a:{stream_order - 1}")
                == decoded_audio_hash(sidecar_path, "0:a:0"),
                f"audio sidecar {stream_order} matches original source stream {stream_order}",
            )
            verified_sidecar_streams.add(stream_order)

    verification.check(
        source_track_indices == [channel for _stream, channel in expected_track_sources],
        "XML maps every sidecar channel exactly once",
    )
    verification.check(
        len(set(sidecar_paths)) == len(channels_per_stream),
        "XML references a distinct sidecar for every source audio stream",
    )

    expected_link_count = expected_audio_tracks + 1
    verification.check(
        all(len(item.findall("link/linkclipref")) == expected_link_count for item in video_items),
        "XML links video with every original audio stream",
    )

    return {
        "name": sequence.findtext("name", ""),
        "media_path": media_path,
        "audio_paths": sidecar_paths,
        "video_timings": video_timings,
        "audio_timings": audio_timings,
        "expected_audio_tracks": expected_audio_tracks,
        "expected_audio_subtypes": [
            "mono" for _stream, _channel in expected_track_sources
        ],
        "expected_output_indices": [
            channel if channels_per_stream[stream - 1] == 2 else None
            for stream, channel in expected_track_sources
        ],
        "frame_rate": frame_rate,
    }


def connect_resolve():
    if os.name == "nt":
        api_root = Path(
            os.environ.get(
                "RESOLVE_SCRIPT_API",
                r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting",
            )
        )
        os.environ.setdefault(
            "RESOLVE_SCRIPT_LIB",
            r"C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript.dll",
        )
        sys.path.insert(0, str(api_root / "Modules"))
    elif sys.platform == "darwin":
        api_root = Path("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting")
        os.environ.setdefault(
            "RESOLVE_SCRIPT_LIB",
            "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
        )
        sys.path.insert(0, str(api_root / "Modules"))
    else:
        api_root = Path("/opt/resolve/Developer/Scripting")
        os.environ.setdefault("RESOLVE_SCRIPT_LIB", "/opt/resolve/libs/Fusion/fusionscript.so")
        sys.path.insert(0, str(api_root / "Modules"))

    import DaVinciResolveScript as dvr  # type: ignore

    return dvr.scriptapp("Resolve")


def resolve_item_timing(item) -> tuple[int, int, int, int]:
    return (
        int(item.GetStart()),
        int(item.GetEnd()),
        int(item.GetSourceStartFrame()),
        int(item.GetSourceEndFrame()),
    )


def resolve_timing_matches_xml(
    expected: tuple[int, int, int, int], actual: tuple[int, int, int, int]
) -> bool:
    expected_start, expected_end, expected_in, expected_out = expected
    actual_start, actual_end, actual_in, actual_out = actual
    return (
        actual_start == expected_start
        and actual_end == expected_end
        and abs(actual_in - expected_in) <= 1
        and abs(actual_out - expected_out) <= 1
    )


def validate_resolve(expected: dict[str, object], verification: Verification) -> None:
    resolve = connect_resolve()
    if not resolve:
        raise RuntimeError("Cannot connect to DaVinci Resolve")
    project = resolve.GetProjectManager().GetCurrentProject()
    timeline = project.GetCurrentTimeline() if project else None
    if not timeline:
        raise RuntimeError("No current Resolve timeline")

    video_tracks = int(timeline.GetTrackCount("video"))
    audio_tracks = int(timeline.GetTrackCount("audio"))
    video_items = timeline.GetItemListInTrack("video", 1) or []
    actual_video_timings = [resolve_item_timing(item) for item in video_items]

    verification.check(
        timeline.GetName() == expected["name"],
        f"current Resolve timeline is '{expected['name']}'",
    )
    verification.check(video_tracks == 1, "Resolve contains exactly one video track")
    verification.check(
        audio_tracks == expected["expected_audio_tracks"],
        f"Resolve contains {expected['expected_audio_tracks']} audio channel tracks",
    )
    expected_video_timings = expected["video_timings"]
    video_timings_match = len(actual_video_timings) == len(expected_video_timings) and all(
        resolve_timing_matches_xml(expected_timing, actual_timing)
        for expected_timing, actual_timing in zip(expected_video_timings, actual_video_timings)
    )
    verification.check(
        video_timings_match,
        "Resolve video items preserve every XML source and timeline boundary",
    )
    if not video_timings_match:
        print(
            f"      item counts: XML={len(expected_video_timings)}, "
            f"Resolve={len(actual_video_timings)}"
        )
        for index, (expected_timing, actual_timing) in enumerate(
            zip(expected_video_timings, actual_video_timings), start=1
        ):
            if not resolve_timing_matches_xml(expected_timing, actual_timing):
                print(
                    f"      first difference at item {index}: "
                    f"XML={expected_timing}, Resolve={actual_timing}"
                )
                break

    for track_index in range(1, audio_tracks + 1):
        items = timeline.GetItemListInTrack("audio", track_index) or []
        expected_audio_timings = expected["audio_timings"][track_index - 1]
        verification.check(
            len(items) == len(expected_audio_timings)
            and all(
                resolve_timing_matches_xml(expected_timing, resolve_item_timing(item))
                for expected_timing, item in zip(expected_audio_timings, items)
            ),
            f"Resolve audio track {track_index} preserves its aligned source cuts",
        )
        expected_subtype = expected["expected_audio_subtypes"][track_index - 1]
        if expected_subtype is not None:
            verification.check(
                timeline.GetTrackSubType("audio", track_index) == expected_subtype,
                f"Resolve audio track {track_index} is {expected_subtype}",
            )

        media_paths = {
            Path(item.GetMediaPoolItem().GetClipProperty("File Path"))
            for item in items
            if item.GetMediaPoolItem()
        }
        verification.check(
            media_paths == {expected["audio_paths"][track_index - 1]},
            f"Resolve audio track {track_index} references the expected sidecar",
        )

    roundtrip_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".xml", delete=False) as temporary_file:
            roundtrip_path = temporary_file.name
        exported = timeline.Export(roundtrip_path, resolve.EXPORT_FCP_7_XML)
        roundtrip_root = ET.parse(roundtrip_path).getroot() if exported else None
        roundtrip_tracks = as_list(roundtrip_root, "./sequence/media/audio/track")
        roundtrip_routing: list[int | None] = []
        for track in roundtrip_tracks:
            output_index = track.findtext("outputchannelindex")
            if output_index is not None:
                roundtrip_routing.append(int(output_index))
                continue
            pan_value = None
            first_item = track.find("clipitem")
            if first_item is not None:
                for filter_element in first_item.findall("filter"):
                    effect = filter_element.find("effect")
                    if effect is None or effect.findtext("effectid") != "audiopan":
                        continue
                    for parameter in effect.findall("parameter"):
                        if parameter.findtext("parameterid") == "pan":
                            pan = float(parameter.findtext("value", "0"))
                            pan_value = 1 if pan < 0 else 2 if pan > 0 else None
            roundtrip_routing.append(pan_value)
        verification.check(
            roundtrip_routing == expected["expected_output_indices"],
            "Resolve preserves left/right routing for every stereo pair",
        )
    finally:
        if roundtrip_path:
            Path(roundtrip_path).unlink(missing_ok=True)

    actual_rate = float(project.GetSetting("timelineFrameRate"))
    verification.check(
        abs(actual_rate - float(expected["frame_rate"])) < 0.01,
        f"Resolve timeline frame rate is {expected['frame_rate']:.3f}",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("xml", type=Path, help="Generated Resolve XML file")
    parser.add_argument(
        "--resolve",
        action="store_true",
        help="Also validate the current timeline through the Resolve scripting API",
    )
    parser.add_argument(
        "--timeline-name",
        help="Override the expected Resolve timeline name",
    )
    args = parser.parse_args()

    verification = Verification()
    try:
        expected = validate_xml(args.xml.resolve(), verification)
        if args.timeline_name:
            expected["name"] = args.timeline_name
        if args.resolve:
            validate_resolve(expected, verification)
    except (OSError, ValueError, RuntimeError, ET.ParseError, subprocess.SubprocessError) as error:
        verification.check(False, str(error))

    if verification.failures:
        print(f"\nResult: FAIL ({len(verification.failures)} check(s))")
        return 1
    print("\nResult: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
