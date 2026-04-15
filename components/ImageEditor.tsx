/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageEditorProps {
  imageBase64: string | null;
  disabled?: boolean;
  onEditedImageChange: (editedBase64: string | null) => void;
}

interface PointerStart {
  x: number;
  y: number;
}

const MIN_CROP_SIZE = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(a: PointerStart, b: PointerStart): CropRect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x);
  const height = Math.abs(a.y - b.y);
  return { x: left, y: top, width, height };
}

function cropToStyle(crop: CropRect, naturalWidth: number, naturalHeight: number) {
  return {
    left: `${(crop.x / naturalWidth) * 100}%`,
    top: `${(crop.y / naturalHeight) * 100}%`,
    width: `${(crop.width / naturalWidth) * 100}%`,
    height: `${(crop.height / naturalHeight) * 100}%`,
  };
}

export default function ImageEditor({ imageBase64, disabled = false, onEditedImageChange }: ImageEditorProps) {
  const imageElementRef = useRef<HTMLImageElement>(null);
  const selectingRef = useRef(false);
  const startPointRef = useRef<PointerStart | null>(null);

  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [pendingCrop, setPendingCrop] = useState<CropRect | null>(null);

  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const sourceDataUrl = useMemo(
    () => (imageBase64 ? `data:image/png;base64,${imageBase64}` : ""),
    [imageBase64]
  );

  const hasCrop = crop !== null;
  const hasFilterEdits = brightness !== 100 || contrast !== 100 || saturation !== 100;
  const hasTransformEdits = rotation !== 0 || flipHorizontal || flipVertical;
  const hasEdits = hasCrop || hasFilterEdits || hasTransformEdits;

  useEffect(() => {
    if (!imageBase64 || !sourceDataUrl) {
      onEditedImageChange(null);
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      const sourceCrop = crop ?? {
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = sourceCrop.width;
      cropCanvas.height = sourceCrop.height;
      const cropContext = cropCanvas.getContext("2d");
      if (!cropContext) {
        onEditedImageChange(null);
        return;
      }

      cropContext.drawImage(
        image,
        sourceCrop.x,
        sourceCrop.y,
        sourceCrop.width,
        sourceCrop.height,
        0,
        0,
        sourceCrop.width,
        sourceCrop.height
      );

      const rotated = rotation === 90 || rotation === 270;
      const outputWidth = rotated ? sourceCrop.height : sourceCrop.width;
      const outputHeight = rotated ? sourceCrop.width : sourceCrop.height;

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = outputWidth;
      outputCanvas.height = outputHeight;

      const outputContext = outputCanvas.getContext("2d");
      if (!outputContext) {
        onEditedImageChange(null);
        return;
      }

      outputContext.save();
      outputContext.translate(outputWidth / 2, outputHeight / 2);
      outputContext.rotate((rotation * Math.PI) / 180);
      outputContext.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
      outputContext.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      outputContext.drawImage(
        cropCanvas,
        -sourceCrop.width / 2,
        -sourceCrop.height / 2,
        sourceCrop.width,
        sourceCrop.height
      );
      outputContext.restore();

      const nextDataUrl = outputCanvas.toDataURL("image/png");
      const nextBase64 = nextDataUrl.replace(/^data:image\/png;base64,/, "");
      onEditedImageChange(hasEdits ? nextBase64 : null);
    };

    image.src = sourceDataUrl;

    return () => {
      cancelled = true;
    };
  }, [
    imageBase64,
    sourceDataUrl,
    crop,
    rotation,
    flipHorizontal,
    flipVertical,
    brightness,
    contrast,
    saturation,
    hasEdits,
    onEditedImageChange,
  ]);

  const toSourcePoint = (clientX: number, clientY: number): PointerStart | null => {
    const imageElement = imageElementRef.current;
    if (!imageElement || !naturalSize.width || !naturalSize.height) return null;

    const bounds = imageElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;

    const localX = clamp(clientX - bounds.left, 0, bounds.width);
    const localY = clamp(clientY - bounds.top, 0, bounds.height);

    return {
      x: Math.round((localX / bounds.width) * naturalSize.width),
      y: Math.round((localY / bounds.height) * naturalSize.height),
    };
  };

  const beginSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const sourcePoint = toSourcePoint(event.clientX, event.clientY);
    if (!sourcePoint) return;

    selectingRef.current = true;
    startPointRef.current = sourcePoint;
    setPendingCrop({ x: sourcePoint.x, y: sourcePoint.y, width: 0, height: 0 });
  };

  const updateSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectingRef.current || !startPointRef.current) return;
    const sourcePoint = toSourcePoint(event.clientX, event.clientY);
    if (!sourcePoint) return;

    const normalized = normalizeCrop(startPointRef.current, sourcePoint);
    setPendingCrop(normalized);
  };

  const endSelection = () => {
    selectingRef.current = false;
    startPointRef.current = null;
  };

  const applyCrop = () => {
    if (!pendingCrop) return;
    if (pendingCrop.width < MIN_CROP_SIZE || pendingCrop.height < MIN_CROP_SIZE) return;
    setCrop(pendingCrop);
    setPendingCrop(null);
  };

  const clearCrop = () => {
    setCrop(null);
    setPendingCrop(null);
  };

  const rotateRight = () => {
    setRotation((current) => {
      if (current === 270) return 0;
      if (current === 180) return 270;
      if (current === 90) return 180;
      return 90;
    });
  };

  const rotateLeft = () => {
    setRotation((current) => {
      if (current === 0) return 270;
      if (current === 90) return 0;
      if (current === 180) return 90;
      return 180;
    });
  };

  const resetAll = () => {
    setCrop(null);
    setPendingCrop(null);
    setRotation(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  const activeOverlay = pendingCrop ?? crop;

  if (!imageBase64) return null;

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-800 p-4 space-y-4 font-mono">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-stone-400">Image Editor</h2>
        <button
          type="button"
          onClick={resetAll}
          disabled={disabled || !hasEdits}
          className="px-3 py-1 rounded border border-stone-600 text-stone-200 text-xs hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      <div
        className="relative select-none rounded-md border border-stone-700 overflow-hidden bg-stone-900"
        onMouseDown={beginSelection}
        onMouseMove={updateSelection}
        onMouseUp={endSelection}
        onMouseLeave={endSelection}
      >
        <img
          ref={imageElementRef}
          src={sourceDataUrl}
          alt="Editable generated output"
          onLoad={(event) => {
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            });
          }}
          className="w-full h-auto max-h-[420px] object-contain block"
          draggable={false}
        />

        {activeOverlay && naturalSize.width > 0 && naturalSize.height > 0 && (
          <div
            className="absolute border-2 border-emerald-400 bg-emerald-500/20 pointer-events-none"
            style={cropToStyle(activeOverlay, naturalSize.width, naturalSize.height)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={applyCrop}
          disabled={
            disabled ||
            !pendingCrop ||
            pendingCrop.width < MIN_CROP_SIZE ||
            pendingCrop.height < MIN_CROP_SIZE
          }
          className="px-3 py-2 rounded border border-stone-600 text-xs text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply Crop
        </button>
        <button
          type="button"
          onClick={clearCrop}
          disabled={disabled || (!crop && !pendingCrop)}
          className="px-3 py-2 rounded border border-stone-600 text-xs text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear Crop
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={rotateLeft}
          disabled={disabled}
          className="px-3 py-2 rounded border border-stone-600 text-xs text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Rotate -90°
        </button>
        <button
          type="button"
          onClick={rotateRight}
          disabled={disabled}
          className="px-3 py-2 rounded border border-stone-600 text-xs text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Rotate +90°
        </button>
        <button
          type="button"
          onClick={() => setFlipHorizontal((value) => !value)}
          disabled={disabled}
          className={`px-3 py-2 rounded border text-xs disabled:opacity-40 disabled:cursor-not-allowed ${
            flipHorizontal
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "border-stone-600 text-stone-200 hover:bg-stone-700"
          }`}
        >
          Flip Horizontal
        </button>
        <button
          type="button"
          onClick={() => setFlipVertical((value) => !value)}
          disabled={disabled}
          className={`px-3 py-2 rounded border text-xs disabled:opacity-40 disabled:cursor-not-allowed ${
            flipVertical
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "border-stone-600 text-stone-200 hover:bg-stone-700"
          }`}
        >
          Flip Vertical
        </button>
      </div>

      <div className="space-y-3">
        <label className="flex flex-col gap-1 text-xs text-stone-300 uppercase tracking-widest">
          Brightness ({brightness}%)
          <input
            type="range"
            min={50}
            max={150}
            value={brightness}
            onChange={(event) => setBrightness(Number(event.target.value))}
            disabled={disabled}
            className="w-full accent-emerald-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-stone-300 uppercase tracking-widest">
          Contrast ({contrast}%)
          <input
            type="range"
            min={50}
            max={150}
            value={contrast}
            onChange={(event) => setContrast(Number(event.target.value))}
            disabled={disabled}
            className="w-full accent-emerald-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-stone-300 uppercase tracking-widest">
          Saturation ({saturation}%)
          <input
            type="range"
            min={0}
            max={200}
            value={saturation}
            onChange={(event) => setSaturation(Number(event.target.value))}
            disabled={disabled}
            className="w-full accent-emerald-500"
          />
        </label>
      </div>
    </div>
  );
}
