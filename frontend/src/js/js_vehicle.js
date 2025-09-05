import SimObject from './js_object.js';
import { FRAME_TYPE_UNKNOWN } from './js_globals.js';

/**
 * Represents a vehicle, extending the base SimObject.
 * This class can be further extended to create specific vehicle types
 * like Copter, Plane, or Rover with specialized logic.
 */
class Vehicle extends SimObject {
    constructor(name) {
        super(name);
        this.type = FRAME_TYPE_UNKNOWN; // Can be set properly later
    }
}

export  default Vehicle ;