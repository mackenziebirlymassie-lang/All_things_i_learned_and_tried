'use strict';

/*
 * A deliberately small, dependency-free schedule parser.  The parser accepts
 * five cron fields (minute, hour, day-of-month, month, day-of-week) plus the
 * friendly interval forms used by FlowForge.  It is designed for predictable
 * local automation rather than trying to be a complete calendar package.
 */

const NAMES = {
  month: new Map(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map((v, i) => [v, i + 1])),
  weekday: new Map(['sun','mon','tue','wed','thu','fri','sat'].map((v, i) => [v, i]))
};

const RANGES = {
  minute: [0, 59],
  hour: [0, 23],
  dayOfMonth: [1, 31],
  month: [1, 12],
  dayOfWeek: [0, 6]
};

function asNumber(value, names) {
  const lower = String(value).trim().toLowerCase();
  if (names && names.has(lower)) return names.get(lower);
  if (!/^\d+$/.test(lower)) return NaN;
  return Number(lower);
}

function expandField(source, range, names) {
  const text = String(source || '*').trim().toLowerCase();
  const values = new Set();
  for (const fragment of text.split(',')) {
    const [base, strideText] = fragment.split('/');
    const stride = strideText === undefined ? 1 : Number(strideText);
    if (!Number.isInteger(stride) || stride < 1) throw new RangeError(`Invalid cron step: ${fragment}`);
    let start = range[0];
    let end = range[1];
    if (base !== '*') {
      if (base.includes('-')) {
        const parts = base.split('-');
        if (parts.length !== 2) throw new RangeError(`Invalid cron range: ${fragment}`);
        start = asNumber(parts[0], names);
        end = asNumber(parts[1], names);
      } else {
        start = asNumber(base, names);
        end = start;
      }
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < range[0] || end > range[1] || start > end) {
      throw new RangeError(`Cron value outside range ${range[0]}-${range[1]}: ${fragment}`);
    }
    for (let value = start; value <= end; value += stride) values.add(value);
  }
  return values;
}

function parseCron(expression) {
  const fields = String(expression).trim().split(/\s+/);
  if (fields.length !== 5) throw new RangeError('Cron expressions must contain five fields');
  return {
    expression: fields.join(' '),
    minute: expandField(fields[0], RANGES.minute),
    hour: expandField(fields[1], RANGES.hour),
    dayOfMonth: expandField(fields[2], RANGES.dayOfMonth),
    month: expandField(fields[3], RANGES.month, NAMES.month),
    dayOfWeek: expandField(fields[4], RANGES.dayOfWeek, NAMES.weekday)
  };
}

function matchesCron(parsed, date) {
  const month = date.getMonth() + 1;
  const dayMatch = parsed.dayOfMonth.has(date.getDate());
  const weekMatch = parsed.dayOfWeek.has(date.getDay());
  const domWildcard = parsed.dayOfMonth.size === 31;
  const dowWildcard = parsed.dayOfWeek.size === 7;
  const calendarMatch = (domWildcard || dowWildcard) ? dayMatch && weekMatch : dayMatch || weekMatch;
  return parsed.minute.has(date.getMinutes()) && parsed.hour.has(date.getHours()) &&
    parsed.month.has(month) && calendarMatch;
}

function nextOccurrence(parsed, from = new Date(), limitMinutes = 366 * 24 * 60) {
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  for (let offset = 0; offset <= limitMinutes; offset += 1) {
    if (matchesCron(parsed, cursor)) return new Date(cursor.getTime());
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

class Schedule {
  constructor(expression, options = {}) {
    this.expression = String(expression).trim();
    this.timezone = options.timezone || 'local';
    this.parsed = parseCron(this.expression);
  }

  matches(date = new Date()) { return matchesCron(this.parsed, date); }
  next(from = new Date()) { return nextOccurrence(this.parsed, from); }
  toJSON() { return { expression: this.expression, timezone: this.timezone }; }
}

function intervalExpression(interval) {
  const value = String(interval).trim().toLowerCase();
  const match = value.match(/^every\s+(\d+)\s+(minute|minutes|hour|hours|day|days)$/);
  if (!match) return value;
  const count = Number(match[1]);
  if (count < 1) throw new RangeError('Interval must be positive');
  if (match[2].startsWith('minute')) return count === 1 ? '* * * * *' : `*/${count} * * * *`;
  if (match[2].startsWith('hour')) return count === 1 ? '0 * * * *' : `0 */${count} * * *`;
  return count === 1 ? '0 0 * * *' : `0 0 */${count} * *`;
}

module.exports = { Schedule, parseCron, matchesCron, nextOccurrence, intervalExpression };
