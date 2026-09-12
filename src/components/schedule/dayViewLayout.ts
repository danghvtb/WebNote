import type { ScheduleBlock } from '../../types';

export interface PositionedDayBlock {
  block: ScheduleBlock;
  startMin: number;
  endMin: number;
  durationMins: number;
  columnIndex: number;
  columnCount: number;
  columnSpan: number;
}

function overlaps(a: PositionedDayBlock, b: PositionedDayBlock): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function getMinutesFromStart(timeStr: string | undefined, defaultHour: number, startHour: number): number {
  if (!timeStr) return (defaultHour - startHour) * 60;

  const [hour, minute] = timeStr.split(':').map(Number);
  const hourValue = Number.isNaN(hour) ? defaultHour : hour;
  const minuteValue = Number.isNaN(minute) ? 0 : minute;
  return Math.max(0, (hourValue - startHour) * 60 + minuteValue);
}

/**
 * Calculates deterministic positions for blocks in the continuous day timeline.
 * Blocks are first assigned to the earliest available column, then expanded into
 * adjacent columns whenever those columns are free for the block's whole interval.
 */
export function computeDayViewLayout(blocks: ScheduleBlock[], startHour = 6): PositionedDayBlock[] {
  const parsed: PositionedDayBlock[] = blocks.map((block) => {
    const startMin = getMinutesFromStart(block.startTime, 9, startHour);
    let endMin = getMinutesFromStart(block.endTime, 10, startHour);

    if (endMin <= startMin) endMin = startMin + 60;

    return {
      block,
      startMin,
      endMin,
      durationMins: endMin - startMin,
      columnIndex: 0,
      columnCount: 1,
      columnSpan: 1,
    };
  });

  parsed.sort(
    (a, b) =>
      a.startMin - b.startMin ||
      b.durationMins - a.durationMins ||
      a.block.id.localeCompare(b.block.id),
  );

  const clusters: PositionedDayBlock[][] = [];
  let currentCluster: PositionedDayBlock[] = [];
  let clusterEnd = -1;

  for (const item of parsed) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }

  if (currentCluster.length > 0) clusters.push(currentCluster);

  for (const cluster of clusters) {
    const columns: PositionedDayBlock[][] = [];

    for (const item of cluster) {
      let columnIndex = 0;
      while (columns[columnIndex]?.some((existing) => overlaps(existing, item))) {
        columnIndex += 1;
      }

      item.columnIndex = columnIndex;
      columns[columnIndex] ??= [];
      columns[columnIndex].push(item);
    }

    const columnCount = columns.length;

    for (const item of cluster) {
      let columnSpan = 1;

      while (item.columnIndex + columnSpan < columnCount) {
        const nextColumn = columns[item.columnIndex + columnSpan];
        if (nextColumn.some((candidate) => overlaps(candidate, item))) break;
        columnSpan += 1;
      }

      item.columnCount = columnCount;
      item.columnSpan = columnSpan;
    }
  }

  return parsed;
}
