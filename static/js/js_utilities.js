// Save | Download image
function downloadImage(data, filename = 'untitled.jpeg') {
    var a = document.createElement('a');
    a.href = data;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
}

/**
 * Fake uuidv4
 * @see https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
 */
function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }



/**
 * 
 * @param {*} p_angleRange 
 * @param {*} p_minAngle 
 * @param {*} p_PWM 
 * @param {*} p_minPWM ex: 1100 or 1000
 * @param {*} p_PWMRange difference between max & min pwm
 * @returns 
 */
 function getAngleOfPWM (p_angleRange, p_minAngle, p_PWM, p_minPWM, p_PWMRange)
 {
   if (p_minPWM==null)
   {
     p_minPWM = 1000;
     p_PWMRange = 1000;
   }
   return ((p_PWM - p_minPWM) / p_PWMRange) * p_angleRange + p_minAngle;
 }


  function addNoise(geometry, noiseX, noiseY, noiseZ) {
    var noiseX = noiseX || 2;
    var noiseY = noiseY || noiseX;
    var noiseZ = noiseZ || noiseY;
    for(var i = 0; i < geometry.vertices.length; i++){
        var v = geometry.vertices[i];
        v.x += -noiseX / 2 + Math.random() * noiseX;
        v.y += -noiseY / 2 + Math.random() * noiseY;
        v.z += -noiseZ / 2 + Math.random() * noiseZ;
    }
    return geometry;
}