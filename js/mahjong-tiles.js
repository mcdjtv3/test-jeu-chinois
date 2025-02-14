/* 
 * Mahjong Solitaire Classic
 *
 * By Rafael Odon (2022)
 * odon.rafael@gmail.com
 * 
 * Credits:
 * - Dot, Bamboo, Character, Wind and Dragon SVGs from: 
 *   https://github.com/FluffyStuff/riichi-mahjong-tiles
 * - Season and Flowers SVGs modified from Jerry Crimson Mann originals at Wikimedia
 *   https://en.wikipedia.org/wiki/Mahjong_tiles
 * 
 * Nodes:
 * - A tile type is identified by it's key, but matches are checked by the group
 */

var TILES_TYPES = {
    "dot1": { name:"Dot 1",  count:4, group:"dot1" },
    "dot2": { name:"Dot 2",  count:4, group:"dot2" },
    "dot3": { name:"Dot 3",  count:4, group:"dot3" },
    "dot4": { name:"Dot 4",  count:4, group:"dot4" },
    "dot5": { name:"Dot 5",  count:4, group:"dot5" },
    "dot6": { name:"Dot 6",  count:4, group:"dot6" },
    "dot7": { name:"Dot 7",  count:4, group:"dot7" },
    "dot8": { name:"Dot 8",  count:4, group:"dot8" },
    "dot9": { name:"Dot 9",  count:4, group:"dot9" },
    "bamboo1": { name:"Bamboo 1",  count:4, group:"bamboo1" },
    "bamboo2": { name:"Bamboo 2",  count:4, group:"bamboo2" },
    "bamboo3": { name:"Bamboo 3",  count:4, group:"bamboo3" },
    "bamboo4": { name:"Bamboo 4",  count:4, group:"bamboo4" },
    "bamboo5": { name:"Bamboo 5",  count:4, group:"bamboo5" },
    "bamboo6": { name:"Bamboo 6",  count:4, group:"bamboo6" },
    "bamboo7": { name:"Bamboo 7",  count:4, group:"bamboo7" },
    "bamboo8": { name:"Bamboo 8",  count:4, group:"bamboo8" },
    "bamboo9": { name:"Bamboo 9",  count:4, group:"bamboo9" },
    "char1": { name:"Characters 1",  count:4, group:"char1" },
    "char2": { name:"Characters 2",  count:4, group:"char2" },
    "char3": { name:"Characters 3",  count:4, group:"char3" },
    "char4": { name:"Characters 4",  count:4, group:"char4" },
    "char5": { name:"Characters 5",  count:4, group:"char5" },
    "char6": { name:"Characters 6",  count:4, group:"char6" },
    "char7": { name:"Characters 7",  count:4, group:"char7" },
    "char8": { name:"Characters 8",  count:4, group:"char8" },
    "char9": { name:"Characters 9",  count:4, group:"char9" },    
    "east": { name:"East Wind",  count:4, group:"east" },
    "south": { name:"South Wind",  count:4, group:"south" },
    "west": { name:"West Wind",  count:4, group:"west" },
    "north": { name:"North Wind",  count:4, group:"north" },
    "red": { name:"Red Dragon",  count:4, group:"red" },
    "green": { name:"Green Dragon",  count:4, group:"green" },
    "white": { name:"White Dragon",  count:4, group:"white" },
    "spring": { name:"Spring",  count:1, group:"season" },
    "summer": { name:"Summer",  count:1, group:"season" },
    "autumn": { name:"Autumn",  count:1, group:"season" },
    "winter": { name:"Winter",  count:1, group:"season" },
    "plum": { name:"Plum Flower",  count:1, group:"flower" },
    "orchid": { name:"Orchid Flower",  count:1, group:"flower" },
    "chrysanthemum": { name:"Chrysanthemum Flower",  count:1, group:"flower" },
    "bamboo": { name:"Bamboo Flower",  count:1, group:"flower" }
};

// Load each tile type image
Object.keys(TILES_TYPES).forEach((key) => {    
    var tileType = TILES_TYPES[key];
    tileType.image = new Image();
    tileType.image.onload = function () {
        console.log("Image",this.src,"loaded");
        tileType.loaded = true;        
    };
    tileType.image.src = "img/tiles/"+key+".svg";    
});

function generateTilesMap() {
    
    // Generates a symbol sequence based on the listed tiles and theirs counts
    var tiles = {};
    Object.keys(TILES_TYPES).forEach((key) => {        
        for(var j=0; j<TILES_TYPES[key].count; j++){
            var id = key+"_"+j; 
            // the tile initial state
            tiles[id] = {
                id: id,
                tileType: key,
                group: TILES_TYPES[key].group,
                x: undefined,
                y: undefined,
                z: undefined,
                removed: false,
                alpha: 1,                
            };
        }
    });

    return tiles;
}

/** 
 * @returns {HTMLCanvasElement} canvas 
 */
function renderEmptyTile(baseColor, tileWidth, tileHeight, tileThickness){

    var tileCanvas = document.createElement("canvas");    
    tileCanvas.width = tileWidth*2;
    tileCanvas.height = tileHeight*2;
    ctx = tileCanvas.getContext("2d");
    ctx.lineWidth = 0.1;

    ctx.translate(tileWidth/2, tileHeight/2);

    // shadow
    var shadowColor = "#000";                    
    ctx.shadowBlur = tileThickness*1.5;
    ctx.shadowColor = shadowColor;
    ctx.shadowOffsetX = tileThickness/4;
    ctx.shadowOffsetY = tileThickness/4;                    
    ctx.roundRect(0, 0, tileWidth, tileHeight, tileThickness);                                        
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.shadowBlur = 0;


    
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;                    

    var skew = 35;

    //side
    ctx.setTransform(ctx.getTransform().skewYSelf(skew));    
    ctx.beginPath();                    
    ctx.roundRect(0, 0, tileThickness*1.5, tileHeight, tileThickness/2);                    
    ctx.fillStyle = ColorTools.changeColorShade(-1.5,baseColor);
    ctx.fill();
    ctx.setTransform(ctx.getTransform().skewYSelf(-skew));

    //top    
    ctx.setTransform(ctx.getTransform().skewXSelf(skew));    
    ctx.beginPath();                    
    ctx.roundRect(0, 0, tileWidth, tileThickness*1.5, tileThickness/2);                    
    ctx.fillStyle = ColorTools.changeColorShade(-1.0,baseColor);
    ctx.fill();                                      
    ctx.setTransform(ctx.getTransform().skewXSelf(-skew));     

    //front    
    ctx.beginPath();
    ctx.roundRect(tileThickness, tileThickness, tileWidth, tileHeight, tileThickness);
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.stroke();

    // light reflex on top corner
    ctx.beginPath();                    
    ctx.roundRect(tileThickness*1.5, tileThickness*1.2, tileWidth*0.92, tileThickness/4, tileThickness/4);                    
    ctx.fillStyle = ColorTools.changeColorShade(0.5,baseColor);
    ctx.fill();

    // light reflex on left corner    
    ctx.beginPath();                    
    ctx.roundRect(tileThickness*1.2, tileThickness*1.5, tileThickness/4, tileHeight*0.90, tileThickness/4);                    
    ctx.fillStyle = ColorTools.changeColorShade(0.5,baseColor);
    ctx.fill();

    // dark edge bottom
    ctx.beginPath(); 
    ctx.roundRect(tileThickness*1.5, tileHeight+tileThickness*0.75, tileWidth*0.92, tileThickness/6, tileThickness/5);                                                          
    ctx.fillStyle = ColorTools.changeColorShade(-1,baseColor);
    ctx.fill();

    return tileCanvas;
}