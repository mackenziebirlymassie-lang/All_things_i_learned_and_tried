'use strict';

const WEEKDAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function startOfDay(date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; }
function addDays(date, days) { const value = new Date(date); value.setDate(value.getDate() + days); return value; }
function parseTime(value) { const match = String(value).match(/^(\d{1,2}):(\d{2})$/); if (!match) throw new Error(`Invalid time: ${value}`); const hour = Number(match[1]); const minute = Number(match[2]); if (hour > 23 || minute > 59) throw new Error(`Invalid time: ${value}`); return { hour, minute }; }

class CalendarRule {
  constructor(input = {}) { this.name = input.name || 'calendar'; this.weekdays = new Set((input.weekdays || [0, 1, 2, 3, 4, 5, 6]).map(value => typeof value === 'string' ? WEEKDAY.indexOf(value.toLowerCase()) : Number(value))); this.start = input.start ? startOfDay(input.start) : null; this.end = input.end ? startOfDay(input.end) : null; this.holidays = new Set((input.holidays || []).map(value => startOfDay(value).toISOString().slice(0, 10))); this.windows = (input.windows || []).map(window => ({ start: parseTime(window.start), end: parseTime(window.end) })); }
  isHoliday(date) { return this.holidays.has(startOfDay(date).toISOString().slice(0, 10)); }
  activeDay(date) { const value = startOfDay(date); return this.weekdays.has(value.getDay()) && !this.isHoliday(value) && (!this.start || value >= this.start) && (!this.end || value <= this.end); }
  activeAt(date) { if (!this.activeDay(date)) return false; if (!this.windows.length) return true; const minutes = date.getHours() * 60 + date.getMinutes(); return this.windows.some(window => { const start = window.start.hour * 60 + window.start.minute; const end = window.end.hour * 60 + window.end.minute; return minutes >= start && minutes <= end; }); }
  next(from = new Date()) { let cursor = new Date(from); cursor.setSeconds(0, 0); for (let index = 0; index < 366; index += 1) { if (this.activeDay(cursor)) { if (!this.windows.length) return startOfDay(cursor); for (const window of this.windows) { const candidate = new Date(cursor); candidate.setHours(window.start.hour, window.start.minute, 0, 0); if (candidate > from) return candidate; } } cursor = addDays(startOfDay(cursor), 1); } return null; }
}

class BusinessCalendar {
  constructor(options = {}) { this.rules = new Map(); this.defaultRule = new CalendarRule(options.defaultRule || {}); }
  add(rule, options) { const value = rule instanceof CalendarRule ? rule : new CalendarRule({ ...options, ...rule }); this.rules.set(value.name, value); return value; }
  get(name) { return this.rules.get(name) || this.defaultRule; }
  isBusinessDay(date, name) { return this.get(name).activeDay(date); }
  addBusinessDays(date, count, name) { let cursor = new Date(date); const direction = count < 0 ? -1 : 1; let remaining = Math.abs(count); while (remaining) { cursor = addDays(cursor, direction); if (this.isBusinessDay(cursor, name)) remaining -= 1; } return cursor; }
  workingMinutes(start, end, name) { let cursor = new Date(start); const finish = new Date(end); let total = 0; while (cursor < finish) { const next = new Date(cursor); next.setMinutes(next.getMinutes() + 1); if (this.get(name).activeAt(cursor)) total += Math.min(60000, finish - cursor) / 60000; cursor = next; } return total; }
}

module.exports = { CalendarRule, BusinessCalendar, startOfDay, addDays, parseTime };
