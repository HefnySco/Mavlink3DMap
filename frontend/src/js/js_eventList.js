const EVENT_LIST = Object.freeze({
  EVENTS: Object.freeze(
    [
      "EVT_VEHICLE_ADDED",
      "EVT_VEHICLE_POS_CHANGED",
      "EVT_VEHICLE_HOME_CHANGED"
    ].reduce((acc, name, index) => {
      acc[name] = `EVT_${index + 1}`;
      return acc;
    }, {})
  )
});

export const EVENTS = EVENT_LIST.EVENTS; // Named export for EVENTS
export default EVENT_LIST;