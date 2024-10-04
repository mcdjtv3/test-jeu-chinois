var ColorTools = {

    // Fonction qui ajuste les composantes RGB en éclaircissant ou assombrissant
    changeRGBShade : (factor, red, green, blue, alpha) => {    
        var newR = Math.round(red + (factor * (factor > 0 ? (255 - red) : red)));
        var newG = Math.round(green + (factor * (factor > 0 ? (255 - green) : green)));
        var newB = Math.round(blue + (factor * (factor > 0 ? (255 - blue) : blue)));
        return "rgba(" + newR + "," + newG + "," + newB + "," + alpha + ")";
    },

    changeRGBStringShade : (factor, color) => {
        var colors = color.toLowerCase().replace("rgba(","").replace("rgb(","").replace(")","").split(",").map(c => c.trim());    
        return ColorTools.changeRGBShade(factor, parseInt(colors[0]), parseInt(colors[1]), parseInt(colors[2]), colors.length === 4 ? parseFloat(colors[3]) : 1);
    },

    changeHexStringShade : (factor, color) => {
        color = color.replace("#","");
        if (color.length == 3) {
            color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
        }
        var red = parseInt(color.substring(0, 2), 16);
        var green = parseInt(color.substring(2, 4), 16);
        var blue = parseInt(color.substring(4, 6), 16);
        return ColorTools.changeRGBShade(factor, red, green, blue, 1);
    },

    changeColorShade : (factor, color) => {
        return color.startsWith("rgb") ?
            ColorTools.changeRGBStringShade(factor, color) :
            ColorTools.changeHexStringShade(factor, color);
    }
};

// Exemple d'utilisation :
var orangeShade = ColorTools.changeHexStringShade(0.0, '#c45302'); // Facteur 0.0 pour garder l'orange intact
console.log(orangeShade);
