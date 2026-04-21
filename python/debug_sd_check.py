from io import BytesIO
from pathlib import Path
from PIL import Image, ImageStat

from services.sd_service import generate_image
from services.image_processor import preprocess_image
from services.block_mapper import image_to_block_grid


def main() -> None:
    out_dir = Path("../debug_outputs")
    out_dir.mkdir(exist_ok=True)

    prompt = "blue flower, white background, flat colors, high contrast, centered composition"
    negative = "photo, realistic, dark background"

    img_bytes = generate_image(prompt=prompt, negative_prompt=negative, width=512, height=512)
    raw_path = out_dir / "blue_flower_raw.png"
    raw_path.write_bytes(img_bytes)

    raw_img = Image.open(BytesIO(img_bytes)).convert("RGB")
    raw_gray = raw_img.convert("L")
    raw_stats = ImageStat.Stat(raw_gray)

    processed = preprocess_image(
        raw_img,
        target_width=128,
        target_height=128,
        palette="full",
        dithering=False,
        auto_adjust=True,
        brightness=1.3,
        contrast=1.4,
    )
    processed_path = out_dir / "blue_flower_processed.png"
    processed.save(processed_path)

    block_grid = image_to_block_grid(processed, "full")
    items = sorted(block_grid.palette_used.items(), key=lambda kv: kv[1], reverse=True)
    total = sum(block_grid.palette_used.values())

    print(f"RAW_IMAGE: {raw_path}")
    print(f"PROCESSED_IMAGE: {processed_path}")
    print(f"RAW_LUMA_MEAN: {raw_stats.mean[0]:.2f}")
    print(f"RAW_LUMA_STDDEV: {raw_stats.stddev[0]:.2f}")
    print("TOP_BLOCKS:")
    for block_id, count in items[:10]:
        print(f"  {block_id}: {count} ({count / total:.2%})")


if __name__ == "__main__":
    main()
