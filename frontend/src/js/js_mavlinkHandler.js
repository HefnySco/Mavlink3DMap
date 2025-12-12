import { c_ArduVehicles } from './js_arduVehicles.js';
import { EVENTS as js_event } from './js_eventList.js'
import { js_eventEmitter } from './js_eventEmitter.js';

class CMavlinkMessageHandler {

    handleHeartbeatNewID(src, v_droneInProgress, c_world, c_mavlinkMessage) {

        v_droneInProgress.add(src);

        const v_vehicle_new = new c_ArduVehicles();
        v_vehicle_new.sid = src;

        if (!c_world.m_scene_env.m_default_vehicle_sid) {
            c_world.m_scene_env.m_default_vehicle_sid = src;
        }

        v_vehicle_new.world = c_world;
        v_vehicle_new.fn_createVehicle(c_mavlinkMessage.type, true, null,
            () => {
                v_vehicle_new.fn_addLabel(`Drone:${src}`);
                v_vehicle_new.fn_setPosition(0, 0, 0);
                v_vehicle_new.fn_castShadow(false);

                c_world.v_scene.add(v_vehicle_new.fn_getMesh());
                c_world.v_drone[src] = v_vehicle_new;
                c_world.fn_registerCamerasOfObject(v_vehicle_new);
                v_droneInProgress.delete(src);

                v_vehicle_new.fn_switchTriggerOn = () => {
                    v_vehicle_new.m_trigger.fn_trigger(null, (v_threeObj, v_physicsObj) => {
                        if (c_world.v_physicsWorld && v_physicsObj) {
                            c_world.v_physicsWorld.addRigidBody(v_physicsObj);
                            c_world.v_rigidBodies.push(v_threeObj);
                        }
                        c_world.v_scene.add(v_threeObj);
                    });
                };
            },
            (p_friendObject) => {
                c_world.v_scene.add(p_friendObject);
            }
        );
    }

    handleRCChannels(v_vehicle, c_mavlinkMessage) {
        const channels = [
            c_mavlinkMessage.chan9_raw, c_mavlinkMessage.chan10_raw,
            c_mavlinkMessage.chan11_raw, c_mavlinkMessage.chan12_raw,
            c_mavlinkMessage.chan13_raw, c_mavlinkMessage.chan14_raw,
            c_mavlinkMessage.chan15_raw, c_mavlinkMessage.chan16_raw
        ];
        v_vehicle.fn_setRCChannels(9, channels);
    }

    handleServosOutputs(v_vehicle, c_mavlinkMessage) {
        const servos = [
            c_mavlinkMessage.servo9_raw, c_mavlinkMessage.servo10_raw,
            c_mavlinkMessage.servo11_raw, c_mavlinkMessage.servo12_raw,
            c_mavlinkMessage.servo13_raw, c_mavlinkMessage.servo14_raw,
            c_mavlinkMessage.servo15_raw, c_mavlinkMessage.servo16_raw
        ];
        v_vehicle.fn_setServosOutputs(9, servos);
    }

    handleGlobalPosition(v_vehicle, c_world, c_mavlinkMessage) {
        v_vehicle.fn_setLatLngAlt(
            c_mavlinkMessage.lat,
            c_mavlinkMessage.lon,
            c_mavlinkMessage.alt,
            c_mavlinkMessage.relative_alt
        );

        js_eventEmitter.fn_dispatch(js_event.EVT_VEHICLE_POS_CHANGED, v_vehicle);
    }


    handleAttitude(v_vehicle, c_mavlinkMessage) {
        v_vehicle.fn_setRotation(
            c_mavlinkMessage.roll,
            c_mavlinkMessage.pitch,
            -c_mavlinkMessage.yaw
        );
    }

    handleHomePosition(v_vehicle, c_mavlinkMessage) {
        v_vehicle.fn_setHomeLatLngAlt(c_mavlinkMessage.latitude, c_mavlinkMessage.longitude, c_mavlinkMessage.altitude);
    }
}

export const js_mavlinkHandler = new CMavlinkMessageHandler();
