var fn_initDesertWorld = function fn_initDesertWorld(p_XZero, p_YZero) {
    var Me = this;

    /**
     * Creates a car vehicle... no moving parts
     * @param {*} p_id object id 
     * @param {*} p_x  x or lat
     * @param {*} p_y y or lng
     * @param {*} p_radius radius of rotation ... moving in circles
     */
    var fn_createCar = function (p_id, p_x, p_y, p_radius) {
        const loader = new THREE.ObjectLoader();
        loader.load('./models/vehicles/car1.json', function (obj) {
            obj.rotateZ(0);
            const c_robot = new c_Object(p_id);
            //const c_robot = new c_vehicle();
            c_robot.fn_createCustom(obj);
            c_robot.fn_setPosition(p_x, p_y, 0);
            c_robot.fn_castShadow(false);
            
            var c_y_deg_step = 0.01;
            var c_y_deg = 0.0;
            var c_deg = Math.random() * Math.PI;

            c_robot.fn_setAnimate(function fn_anim() {
                c_y_deg += c_y_deg_step;
                if (c_y_deg >= 1.1) {
                    c_y_deg_step = -0.01
                    c_y_deg = 1.1;
                } else if (c_y_deg <= -1.1) {
                    c_y_deg_step = 0.01
                    c_y_deg = -1.1;
                }

                c_robot.fn_setPosition(p_radius * Math.cos(c_deg) + p_x, p_radius * Math.sin(c_deg) + p_y, 0);
                c_deg = (c_deg + 0.01) % 6.12;
                c_robot.fn_setRotation(0, 0, - c_deg - PI_div_2);
            });


            Me.fn_registerCamerasOfObject(c_robot);
            c_robot.fn_setRotation(0, 0.0, 0.0);
            Me.v_robots[p_id] = c_robot;
            Me.v_scene.add(c_robot.fn_getMesh());
        }, function (xhr) {
            console.log(xhr);
        }, function (xhr) {
            console.log(xhr);
        });

    };

    if (p_XZero == null) p_XZero = v_XZero;
        if (p_YZero == null) p_YZero = v_YZero;
     
        var loader = new THREE.ObjectLoader();
        loader.load('./models/grass_plan.json', function (obj) {
            obj.position.set(p_XZero, -0.01, p_YZero);
            obj.rotateZ(0);

            Me.v_scene.add(obj);

        });


        const c_buildings = [
            [
                -16, -8
            ],
            [
                -16, -12
            ],
            [
                -16, -16
            ],
            [
                16, 20
            ],
            [
                16, 24
            ],
            [
                16, 28
            ]
        ];
        for (var i = 0; i < c_buildings.length; ++ i) {
            const c_location = c_buildings[i];
            var loader = new THREE.ObjectLoader();
            loader.load('./models/building1.json', function (obj) {
                obj.position.set(p_XZero + c_location[0], 0.01, p_YZero + c_location[1]);
                obj.rotateZ(0);

                Me.v_scene.add(obj);
            });
        }


        var loader = new THREE.ObjectLoader();
        loader.load('./models/building2.json', function (obj) {
            obj.position.set(p_XZero + 22, 0.0, p_YZero + 0);
            obj.rotateZ(0);

            Me.v_scene.add(obj);

        });

        fn_createCar ('car'  + uuidv4(),  p_XZero + 10, p_YZero + 0, 7);

        var ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        Me.v_scene.add(ambientLight);

        var directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        Me.v_scene.add(directionalLight);

};