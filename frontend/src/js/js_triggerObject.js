/* ********************************************************************************
*   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   16 Oct 2020
*
*********************************************************************************** */


/*jshint esversion: 6 */
import { BallThrower } from './js_ball_thrower.js';

class Trigger {

    constructor() {
        this.vehicle = null; // c_ArduVehicles
        this.thrower = null; // BallThrower
    }

    attach(vehicle) {
        this.vehicle = vehicle;
        return this;
    }

    /**
     * Configure or replace the ball thrower.
     * options: { offset:{x,y,z}, velocity:{x,y,z}, radius, color }
     */
    setThrower(options) {
        if (!this.vehicle) return;
        this.thrower = new BallThrower(this.vehicle, options || {});
    }

    /**
     * Execute trigger: throw a ball if thrower configured.
     */
    fn_trigger(world) {
        if (this.thrower && world) {
            this.thrower.throw(world);
        }
    };
}

export { Trigger };