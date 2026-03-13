"use strict";

/**
 * Minimal event log for attack tests. Records typed events with metadata.
 * Not a full analytics system—just enough for assertions.
 */

function createEventLog() {
  const events = [];

  function log(type, data = {}) {
    events.push({
      type,
      ...data,
      _index: events.length
    });
  }

  function getEvents() {
    return [...events];
  }

  function getEventsByType(type) {
    return events.filter((e) => e.type === type);
  }

  function clear() {
    events.length = 0;
  }

  function getTick() {
    return events.length;
  }

  return {
    log,
    getEvents,
    getEventsByType,
    clear,
    getTick
  };
}

module.exports = { createEventLog };
