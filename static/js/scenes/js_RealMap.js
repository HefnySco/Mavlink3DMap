

var fn_init3DWorld = function fn_init3DWorld(p_XZero, p_YZero) {
    var Me = this;
    

    function getHeightOf3DPoint (p_x, p_y)
    {
        var res = (new THREE.Raycaster(new THREE.Vector3(p_x,18900,p_y), new THREE.Vector3(p_x,-1.57,p_y),1,50000)).intersectObject(window.terrain, true);
        if ((res == null) || (res.length ==0))
        {
            return 0;
        }
        else
        {
            return 18900 - Math.floor(res[0].distance);
        }
    }

    function createObject2( mass, object, p_scale) {
        const v_threeObj =  createObject(mass, p_scale, object.position, object.quaternion, createMaterial( 0xB03014 ));
        v_threeObj.userData.m_removeMe = object;
        Me.v_scene.add(v_threeObj);

    }

    /**
     * Helper function to create material.
     * @param {*} color 
     */
    function createMaterial( color ) {

        color = color || createRandomColor();
        return new THREE.MeshPhongMaterial( { color: color } );

    }



    function createObject( mass, halfExtents, pos, quat, material ) {

        var v_threeObj = new THREE.Mesh( new THREE.BoxBufferGeometry( halfExtents.x , halfExtents.y , halfExtents.z ), material );
        v_threeObj.position.copy( pos );
        v_threeObj.quaternion.copy( quat );
        Me.v_convexBreaker.prepareBreakableObject( v_threeObj, mass, new THREE.Vector3(), new THREE.Vector3(), true );
        const v_body = c_PhysicsObject.fn_createDebrisFromBreakableObject( v_threeObj );
        
        if ( mass > 0 ) {
            Me.v_rigidBodies.push( v_threeObj );
            // Disable deactivation
            v_body.setActivationState( STATE.DISABLE_DEACTIVATION );
        }

        Me.v_physicsWorld.addRigidBody( v_body );

        Me.v_rigidBodies.push(v_threeObj);
        
        return v_threeObj;
    }



    

    if (p_XZero == null) p_XZero = v_XZero;
    if (p_YZero == null) p_YZero = v_YZero;
    
    /**
     * Adjust heights of local cameras of views to the new 3D heights.
     * This is to avoid scrolling up.
     */
    function fn_adjustLocalCamerasBasedOnHeight()
    {
        // Adjust cameras to new locations
        for (var i = 0; i < Me.v_views.length; ++ i) 
        {
            for (var j=0; j < Me.v_views[i].v_localCameras.length; ++j)
            {
                if ((Me.v_views[i].v_localCameras[j] instanceof THREE.PerspectiveCamera) === true)
                {
                    Me.v_views[i].v_localCameras[j].position.y = Me.v_height3D +  (70 + i*70);
                    Me.v_views[i].v_localCameras[j].lookAt(new THREE.Vector3(p_XZero + 0, Me.v_height3D, p_YZero + 0));
                }
            }
        }
    }

    function fn_onMapLoaded ()
    {

        

        // const c_buildings = [
        //     [
        //         -16, -8
        //     ],
        //     [
        //         -16, -12
        //     ],
        //     [
        //         -16, -16
        //     ],
        //     [
        //         16, 20
        //     ],
        //     [
        //         16, 24
        //     ],
        //     [
        //         16, 28
        //     ]
        // ];

        // for (var i = 0; i < c_buildings.length; ++ i) {
        //     const c_location = c_buildings[i];
        //     var loader = new THREE.ObjectLoader();
        //     loader.load('./models/building1.json', function (p_obj) {
        //         p_obj.position.set(p_XZero + c_location[0], 0.01, p_YZero + c_location[1]);
        //         p_obj.rotateZ(0);
    
        //         createObject2(10, p_obj, new THREE.Vector3( 2.2, 0.8, 2 ));
        //         Me.v_scene.add(p_obj);
                
        //     });
        // }
    
    
        // var loader = new THREE.ObjectLoader();
        // loader.load('./models/building2.json', function (p_obj) {
        //     p_obj.position.set(p_XZero + 22, 0.0, p_YZero + 0);
        //     p_obj.rotateZ(0);
    
            
        //     createObject2(10, p_obj, new THREE.Vector3( 2.2, 1.5, 2.4 ));
        //     Me.v_scene.add(p_obj);
        // });
    
    
        // loader.load('./models/oiltankcomplex.json', function (p_obj) {
        //     p_obj.position.set(p_XZero + 40, 0.0, p_YZero + 0);
        //     p_obj.rotateZ(0);
            
        //     Me.v_scene.add(p_obj);
    
        // });
    
    
        //fn_createWater ('water', 40, 40, 10, 10);
        var ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        Me.v_scene.add(ambientLight);
    
        var directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        Me.v_scene.add(directionalLight);
    };


    
    (async () => { // main
        const tgeo = new ThreeGeo({
            tokenMapbox: 'pk.eyJ1IjoibWhlZm55IiwiYSI6ImNrZW84Nm9rYTA2ZWgycm9mdmNscmFxYzcifQ.c-zxDjXCthXmRsErPzKhbQ', // <---- set your Mapbox API token here
        });

        if (tgeo.tokenMapbox === '********') {
            const warning = 'Please set your Mapbox API token in ThreeGeo constructor.';
            alert(warning);
            throw warning;
        }
        //const terrain = await tgeo.getTerrainVector
        const c_RADIUS = 5.0;
        const terrain = await tgeo.getTerrainRgb(
            //[46.5763, 7.9904], // [lat, lng]
            //[29.9763167, 31.1340986], // [lat, lng] Pyramids
            [-35.3632621, 149.1652374], // [lat, lng] // AUS
            //[46.5763, 7.9904], // ALP
            c_RADIUS,               // radius of bounding circle (km)
            14);               // zoom resolution
            window.terrain = terrain;
            Me.v_scene.add(terrain);
            terrain.setRotationFromEuler(new THREE.Euler(-1.57,0,-1.57,"XYZ"))
            terrain.scale.x = c_RADIUS * MAP_SCALE ;
            terrain.scale.y = c_RADIUS * MAP_SCALE ;
            terrain.scale.z = 1;

            
            const c_body = c_PhysicsObject.fn_createBox(0, terrain);
            terrain.userData.m_physicsBody = c_body;
            Me.v_physicsWorld.addRigidBody( c_body );
            Me.v_rigidBodies.push(terrain)

            setTimeout (function () {
                Me.v_height3D = getHeightOf3DPoint(0,0);
                fn_adjustLocalCamerasBasedOnHeight();
            },
            1000
            );

            fn_onMapLoaded();
        
    })();


    
};