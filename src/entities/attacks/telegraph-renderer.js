/**
 * TelegraphRenderer - draws telegraph shapes for enemy attacks.
 * Colors: heavy=red, magic=purple, poison=green, fast=yellow
 */

const TELEGRAPH_COLORS = {
  heavy: "rgba(239, 68, 68, ",
  magic: "rgba(147, 51, 234, ",
  poison: "rgba(34, 197, 94, ",
  fast: "rgba(250, 204, 21, "
};

export function getTelegraphColor(flag) {
  if (flag === "heavy" || flag === "magic" || flag === "poison" || flag === "fast") {
    return TELEGRAPH_COLORS[flag];
  }
  return TELEGRAPH_COLORS.heavy;
}

export function drawCircleTelegraph(ctx, pos, radius, alpha, color) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = (color || TELEGRAPH_COLORS.heavy) + "0.9)";
  ctx.fillStyle = (color || TELEGRAPH_COLORS.heavy) + "0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawRingTelegraph(ctx, pos, radius, thickness, alpha, color) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = (color || TELEGRAPH_COLORS.heavy) + "0.9)";
  ctx.fillStyle = (color || TELEGRAPH_COLORS.heavy) + "0.2)";
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawConeTelegraph(ctx, pos, dirAngle, arcAngle, range, alpha, color) {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(dirAngle);
  ctx.globalAlpha = alpha;
  const halfArc = (arcAngle * Math.PI) / 360;
  ctx.fillStyle = (color || TELEGRAPH_COLORS.heavy) + "0.3)";
  ctx.strokeStyle = (color || TELEGRAPH_COLORS.heavy) + "0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, range, -halfArc, halfArc);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawLineTelegraph(ctx, pos, dirAngle, length, width, alpha, color) {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(dirAngle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = (color || TELEGRAPH_COLORS.heavy) + "0.35)";
  ctx.strokeStyle = (color || TELEGRAPH_COLORS.heavy) + "0.9)";
  ctx.lineWidth = 2;
  ctx.fillRect(0, -width / 2, length, width);
  ctx.strokeRect(0, -width / 2, length, width);
  ctx.restore();
}
