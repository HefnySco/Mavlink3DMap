

/**
 * get distance between two ponts
 * see: https://www.movable-type.co.uk/scripts/latlong.html
*/
var get_distance = function  (lat1, lat2, lon1, lon2) 
{
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c; // in metres

    return d;
}


var get_bearing = function (lat1, lat2, lon1, lon2)
{
    const λ1 = lon1 * Math.PI/180; // φ, λ in radians
    const λ2 = lon2 * Math.PI/180;
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const y = Math.sin(λ2-λ1) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) -
            Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
    const θ = Math.atan2(y, x);
    const brng = (θ*180/Math.PI + 360) % 360; // in degrees
    
    return brng * Math.PI / 180;
}


var get_UrlParameter = function get_UrlParameter (sParam) {
    var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return typeof sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }
    return false;
};


