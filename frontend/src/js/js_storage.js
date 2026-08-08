// Simple browser storage helper

export function getStringFromStorage(key, defaultValue = '') {
  if (typeof window === 'undefined') return defaultValue;

  let value = defaultValue;

  try {
    if (window.localStorage) {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) value = stored;
    }
  } catch (e) {
    // ignore storage errors
  }

  if (window[key] != null) {
    value = String(window[key]);
  }

  return value;
}

export function setStringInStorage(key, value) {
  if (typeof window === 'undefined') return;

  try {
    if (window.localStorage) {
      window.localStorage.setItem(key, String(value));
    }
  } catch (e) {
    // ignore storage errors
  }

  window[key] = String(value);
}

export function getBoolFromStorage(key, defaultValue = false) {
  const strDefault = defaultValue ? 'true' : 'false';
  const v = getStringFromStorage(key, strDefault).toLowerCase();
  return v === 'true' || v === '1';
}

function setBoolInStorage(key, value) {
  setStringInStorage(key, value ? 'true' : 'false');
}

export function getBuildingsPerTileFlag() {
  // default is true (keep existing behavior)
  return getBoolFromStorage('BUILDINGS_PER_TILE', true);
}

export function setBuildingsPerTileFlag(value) {
  setBoolInStorage('BUILDINGS_PER_TILE', value);
}

export function getCarsEnabledFlag() {
  // default is false (keep existing behavior)
  return getBoolFromStorage('CARS_ENABLED', false);
}

export function setCarsEnabledFlag(value) {
  setBoolInStorage('CARS_ENABLED', value);
}

export function getPlansEnabledFlag() {
  // default is false (keep existing behavior)
  return getBoolFromStorage('PLANS_ENABLED', false);
}

export function setPlansEnabledFlag(value) {
  setBoolInStorage('PLANS_ENABLED', value);
}

export function getPhysicsEnabledFlag() {
  // default is false: physics/ball throwing off unless explicitly enabled
  return getBoolFromStorage('PHYSICS_ENABLED', false);
}

export function setPhysicsEnabledFlag(value) {
  setBoolInStorage('PHYSICS_ENABLED', value);
}

export function getQuadType() {
  // default is normal
  return getStringFromStorage('QUAD_TYPE', 'normal');
}

export function setQuadType(value) {
  setStringInStorage('QUAD_TYPE', value);
}

export function getStoredViewCount() {
  // default is 4
  return getStringFromStorage('VIEW_COUNT', '4');
}

export function setStoredViewCount(value) {
  setStringInStorage('VIEW_COUNT', value);
}

export function getAirportsEnabledFlag() {
  // default is false (keep existing behavior)
  return getBoolFromStorage('AIRPORTS_ENABLED', false);
}

export function setAirportsEnabledFlag(value) {
  setBoolInStorage('AIRPORTS_ENABLED', value);
}


