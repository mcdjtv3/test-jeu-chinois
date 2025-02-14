/* 
 * Mahjong Solitaire Classic
 *
 * By Rafael Odon (2022)
 * odon.rafael@gmail.com
 * 
 */

// board matrix dimension constants
var MAX_Z = 5; // the number of tiles levels + 1
var MAX_Y = 17; // twice the number of rows + 1
var MAX_X = 30; // twice the number of cols
var PIXEL_RATIO = Math.ceil(window.devicePixelRatio);
var MAX_COMBO_TIME = 3500;

var gameState = {}

// version info from manifest
var version = "---"
fetch('manifest.json').then((response) => {    
    response.json().then((manifest) => {
        document.getElementById("version").innerText = "v"+manifest.version;
    });
})

// round rect
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
}

window.onload = () => {

    var gameState = {};
    var modal = new Modal();
    var timer = new Timer();
    var mahjongData = new MahjongData();
    var lastGameData = {};
    var lastWinData = undefined;
    var comboTimer = 0;
    var comboCount = 0;     
    var preRenderedTiles = {};    
    var preRenderCanvas = document.createElement("canvas");
    var preRenderContext = preRenderCanvas.getContext("2d");

    function clearGameState(){
        Object.assign(gameState, {            
            board: undefined,        
            tiles: [],
            solver: undefined,            
            movesAvailable: 0,
            cursor: undefined,
            cursorTile: undefined,
            selectedTile: undefined,
            undos: 0,
            hints: 0,
            combos: 0,
            topBarMessage: "",
            hint: [],            
            soundOn: true,   
            isRunning: false,
            hasWon: false
        });
    }

    function distributeTilesClassicBoard() {
        
        var tilesMap = generateTilesMap();    
        var board = MahjongUtils.generateEmptyMatrix(MAX_X, MAX_Y, MAX_Z);

        // a random stack of tiles to be unstacked while filling the board
        var tilesStack = Object.values(tilesMap)
        MahjongUtils.shuffleArray(tilesStack);    
        tilesStack = null;

        //central stacked rectangles
        MahjongUtils.fillBoard(board, tilesStack, 7, 1, 21, 15, 0);
        MahjongUtils.fillBoard(board, tilesStack, 9, 3, 19, 13, 1);
        MahjongUtils.fillBoard(board, tilesStack, 11, 5, 17, 11, 2);
        MahjongUtils.fillBoard(board, tilesStack, 13, 7, 15, 9, 3);
        MahjongUtils.fillBoard(board, tilesStack, 14, 8, 14, 8, 4);

        //1st line extra tiles
        MahjongUtils.fillBoard(board, tilesStack, 3, 1, 5, 1, 0);
        MahjongUtils.fillBoard(board, tilesStack, 23, 1, 25, 1, 0);

        //3nd line extra tiles
        MahjongUtils.fillBoard(board, tilesStack, 5, 5, 5, 5, 0);
        MahjongUtils.fillBoard(board, tilesStack, 23, 5, 23, 5, 0);

        //4th and 5th lines extra tiles
        MahjongUtils.fillBoard(board, tilesStack, 3, 7, 5, 9, 0);
        MahjongUtils.fillBoard(board, tilesStack, 23, 7, 25, 9, 0);

        //4th and 5th lines blocking mid tiles
        MahjongUtils.fillBoard(board, tilesStack, 1, 8, 1, 8, 0);
        MahjongUtils.fillBoard(board, tilesStack, 27, 8, 29, 8, 0);

        //6th line extra tiles
        MahjongUtils.fillBoard(board, tilesStack, 5, 11, 5, 11, 0);
        MahjongUtils.fillBoard(board, tilesStack, 23, 11, 23, 11, 0);

        //8th line extra tiles
        MahjongUtils.fillBoard(board, tilesStack, 3, 15, 5, 15, 0);
        MahjongUtils.fillBoard(board, tilesStack, 23, 15, 25, 15, 0);

        disposeTilesOnEmptyBoard(Object.values(tilesMap), board);        

        return new MahjongBoard(tilesMap, board);
    }

    function initGameWithClassicDisposition() {              
        
        console.log("INIT");

        clearGameState();
        
        // generate a solvable board of stacked tiles
        var newBoard = [];
        var solver = undefined;
        var solvable = false;
        do{                    
            try{
                console.log("Trying to generate a solvable board...")
                newBoard = distributeTilesClassicBoard();
                solver = new MahjongSolver(newBoard);
                solvable = solver.isBoardSolvable();        
            }catch(e){
                console.error(e);
            }
        }while(solvable != true);
        
        // fast forward N moves (add the query parameter ?ff=N) (for debugging purposes)        
        var ff = new URLSearchParams(window.location.search).get("ff");        
        if(ff){            
            var moves = solver.getMoves();        
            for(var i=0; i<ff; i++){
                var move = moves.shift();
                if(move){
                    newBoard.removeTilesIfMatch(newBoard.getTileById(move[0]),newBoard.getTileById(move[1]));
                }
            }
        }
        
        gameState.board = newBoard;
        gameState.tiles = newBoard.getTilesList().sort(MahjongUtils.compareTilesByRenderOrder);
        gameState.solver = new MahjongSolver(newBoard);                
        updateMovesLeft();
        timer.stop();      
        gameState.isRunning = true;
        lastWinData = undefined;
    }

    /**
     * 
     * @param {Array} tiles 
     * @param {Array} board 
     */
    function disposeTilesOnEmptyBoard(tiles, board){    
                
        // group tiles that match
        var groups = {};        
        tiles.forEach((tile) => {
            if(!(tile.group in groups)){
                groups[tile.group] = [];    
            }
            groups[tile.group].push(tile);
        });
        
        // generate an array of random tile pairs
        var pairs = [];
        Object.values(groups).forEach((group) => {
            MahjongUtils.shuffleArray(group);
            while(group.length > 0){
                pairs.push([group.pop(), group.pop()]);
            }
        });
        MahjongUtils.shuffleArray(pairs);

        while(pairs.length > 0){

            var pair = pairs.pop();            
            var tile1 = pair[0];
            var tile2 = pair[1];
            
            var posT1 = findAFreePosition(board,undefined,pairs.length==0);
            if(posT1){
                MahjongUtils.addTileToBoard(tile1, board, posT1.x, posT1.y, posT1.z);                            
            }
            
            var posT2 = findAFreePosition(board,tile1,pairs.length==0);            
            if(posT2){
                MahjongUtils.addTileToBoard(tile2, board, posT2.x, posT2.y, posT2.z);                              
            }
        }
    }

    function TilePositioningException() {}

    function findAFreePosition(board,pair,last=false){
        var positions = [];
        for (var z = 0; z < board.length; z++) {            
            for (var y = 0; y < board[z].length; y++) {
                for (var x = 0; x < board[z][y].length; x++) {             
                    // the position is free                             
                    var isFree = board[z][y][x] === null;                    

                    // is in the first level or on top of another piece
                    var isGrounded = z == 0 || (z > 0 && board[z-1][y][x]);                    
                    
                    // is the first tile on a empty row, or is beside another tile
                    var rowLength = board[z][y].filter((e)=>e).length;                                        
                    var hasNeighbour = (x>0 && board[z][y][x-1]) || (x < MAX_X-3 && board[z][y][x+2]);
                    var firstOrBeside = rowLength == 0 || hasNeighbour;

                    // is blocking a tile beside
                    var blocksPairBeside = pair && rowLength > 1 && (z == pair.z && y == pair.y && (x == pair.x+2 || x == pair.x-2));

                    // is blocking a tile below
                    var blocksPairBelow = pair && (x == pair.x && y == pair.y && z == pair.z+1);                    

                    // is one of the offset tiles in the central row
                    var isOffsetFree = (z==4) || (y % 2 != 0) || (y % 2 == 0 && (hasNeighbour));
                    
                    /**
                     * The basic requirement is: the position must be free and grounded.
                     * If it is not the last tile, optimze by checking the other requirements.
                     */
                    if(isFree && isGrounded && (last || (isOffsetFree && firstOrBeside && !blocksPairBelow && !blocksPairBeside))){                                        
                        positions.push({x:x, y:y, z:z});
                    }
                }
            }

            // if there are considerable free positions on the current levels, abort
            // looking for more position on the upper levels (bottom-top approach)
            if(positions.length > 4){
                break;
            }
        }        
        if(positions.length > 0){
            var index = Math.round(Math.random()*(positions.length-1));
            var position = positions[index];                           
            return position;            
        }else{
            throw new TilePositioningException();
        }
    }

    function onMouseMove(e) {
        e.stopPropagation();
        gameState.cursor = {
            x: e.offsetX * PIXEL_RATIO,
            y: e.offsetY * PIXEL_RATIO 
        };
    }

    function onMouseOut() {
        gameState.cursor = undefined;
    }

    function onMouseDown(e) {
        e.stopPropagation();
        updateCursorTile();
        selectCursorTile();
    }

    // check wich tile is under the cursor in a top-down approach
    function updateCursorTile() {
        if (gameState.cursor) {
            for (var cZ = MAX_Z - 1; cZ >= 0; cZ--) {
                // calculate the tile x,y considering the stack level offset
                var cX = Math.floor((gameState.cursor.x - (cZ + 1) * gameState.tileThickness - gameState.tileThickness) / gameState.tileWidth * 2);
                var cY = Math.floor((gameState.cursor.y - (cZ + 1) * gameState.tileThickness - gameState.tileThickness) / gameState.tileHeight * 2);
                if (cX >= 0 && cY >= 0 && cY < MAX_Y && cX <= MAX_X) {
                    var tile = gameState.board.getTileAt(cX, cY, cZ);
                    if (gameState.board.isTileFree(tile)) {                                        
                        gameState.cursorTile = tile;
                        break;
                    } else {
                        gameState.cursorTile = undefined;
                    }
                }
            }
        }
    }
    
    function playSoundFx(key){
        if(gameState.soundOn){
            SOUND_FX[key].play(); 
        }
    }

    // try to select the current cursor tile.
    // if there's another tile selected, try a game move;
    function selectCursorTile() {    
        
        if(gameState.movesAvailable > 0 && gameState.cursorTile){

            // starts/resume timing            
            timer.startOrResume();

            gameState.board.removeTilesIfMatch(
                gameState.selectedTile,
                gameState.cursorTile,
                () => {
                    // success
                    playSoundFx("vanish");
                    clearSelected();
                    updateMovesLeft();                                        
                    updateCombo();
                                                                 
                    if(gameState.board.hasFinished()){
                        onWinGame();
                    }else if(gameState.movesAvailable == 0) {
                        onGameOver();
                    }
                },
                () => {
                    // if no removal happend, selects the cursor tile                    
                    if(gameState.selectedTile != gameState.cursorTile){
                        playSoundFx("wood");
                        clearSelected();
                        gameState.selectedTile = gameState.cursorTile;
                    }
                }
            );
        }else{
            // outside clicks unselect things
            clearSelected();
        }              
    }

    function updateMovesLeft(){
        gameState.movesAvailable = gameState.solver.countMovestLeft();
        gameState.topBarMessage = "Free tiles: "+gameState.movesAvailable;    
    }

    function updateCombo(){        
        if(comboTimer > 0){            
            comboCount += 1;                        
            gameState.combos += 1;                        
            document.getElementById("combo").className = "animatedVisible";
            setTimeout(function (){
                SOUND_FX["piano"].play((comboCount+1)*75);                            
                document.getElementById("combo").classList.add("animatedZoomInOut");                
            },500);
        }
        comboTimer = MAX_COMBO_TIME;
    }

    function onWinGame(){        
        if(gameState.hasWon == false){
            gameState.hasWon = true;  
            gameState.topBarMessage = "🏆 Congratulations!";
            timer.pause();    
            playSoundFx("victory");
            updateStats();
            mahjongData.clearGameData();
            disableButtons();
            setTimeout(() => {                                                            
                var count=0;
                var inverval=40;
                for(var aZ=0; aZ<MAX_Z; aZ++){                
                    winAnimationArray = gameState.tiles.filter((t)=>t.z==aZ);                                                                                
                    var tile1,tile2=undefined;
                    while(winAnimationArray.length > 0){                        
                        tile1 = winAnimationArray.shift();                       
                        if(tile1){                            
                            setTimeout(setupTileForWinAnimation, (count++)*inverval, tile1)                        
                        }

                        tile2 = winAnimationArray.pop();                    
                        if(tile2){                            
                            setTimeout(setupTileForWinAnimation, (count++)*inverval, tile2, false)
                        }                    
                    }   
                    inverval+=2;
                }                
                // show ranking modal with a start-new-game callback on the ok button
                setTimeout(showRanking,count*inverval+500,(modal)=>{                    
                    modal.hide();                    
                    startNewGame();                    
                });
            },500);
        }
    }

    function showRanking(okCallback=undefined){
        var stats = mahjongData.loadGameStats();
        
        var ranking = document.createElement("div");
        var rankingTable = document.createElement("table");
        ranking.className = "ranking";
        rankingTable.className = "rankingTable";
        ranking.appendChild(rankingTable);
        
        //generates a ranking table form the stats
        if(stats && stats.ranking && stats.ranking.length > 0){
            stats.ranking.sort((a,b) => {                
                var r = Math.round(a.ellapsedMillliseconds/1000) - Math.round(b.ellapsedMillliseconds/1000);
                return r != 0 ? r : a.undos - b.undos;
            } );
            rankingTable.innerHTML = "";
            stats.ranking.forEach((stat,i)=>{
                var tr = document.createElement("tr")
                if(lastWinData && stat.date == lastWinData.date){
                    tr.className = "lastVictory";
                }
                var date = new Date(stat.date);
                var dateString = date.getFullYear()+"-"+zeroPad(date.getMonth()+1)+"-"+zeroPad(date.getDate());
                var hourString = zeroPad(date.getHours()) + ":" + zeroPad(date.getMinutes());
                tr.innerHTML = "<td>#"+(i+1)+"</td>";
                tr.innerHTML += "<td>"+dateString+" "+hourString+"</td>";
                tr.innerHTML += "<td>"+stat.ellapsedMillliseconds/1000+" s</td>";
                tr.innerHTML += "<td style='font-size: 0.7em'>"+
                    (stat.undos ? stat.undos+" undo. " : " ")+
                    (stat.hints ? stat.hints+" hint. " : " ")+
                    (stat.combos ? stat.combos+" combo." : " ")+
                    "</td>";
                rankingTable.appendChild(tr);
            });
        }else{
            ranking.innerHTML = "(empty)";
        }
                
        // scrolls to the last win row if necessary
        if(lastWinData){            
            setTimeout(()=> {                                
                var rankingHeight = document.getElementsByClassName("ranking")[0].clientHeight;
                var winTop = document.getElementsByClassName("lastVictory")[0].offsetTop;
                if(winTop > rankingHeight-10){
                    TweenManager.addTween(new Tween({
                        obj:document.getElementsByClassName("ranking")[0],
                        key:"scrollTop",
                        initialValue: 0,
                        endValue: winTop-40,
                        durationMs: 800,
                        type: TweenType.EASE_IN
                    }).start());
                }
            },500);
        }

        modal.show({
            headerContent: "Ranking",
            bodyContent: ranking.outerHTML,
            cancelButtonText: "Clear",
            okCallback: okCallback,
            cancelCallback: (modal) => {                
                modal.show({
                    headerContent: "Clear rank?",
                    bodyContent: "All the past games records will be cleared.",
                    okCallback: () => {
                        lastWinData = undefined;
                        mahjongData.clearStats();
                        showRanking(okCallback);
                    },
                    cancelCallback: () => {
                        showRanking(okCallback);
                    }
                });
            }
        }); 
    }

    function zeroPad(num){
        return num > 9 ? num : "0"+num;
    }
    
    function updateStats(){        
        var stats = mahjongData.loadGameStats();        
        lastWinData = {
            date: Date.now(),
            ellapsedMillliseconds: timer.getEllapsedMillliseconds(),
            undos: gameState.undos,
            hints: gameState.hints,
            combos: gameState.combos
        };
        stats.ranking.push(lastWinData);
        mahjongData.saveGameStats(stats);
    }

    function onGameOver() {
        gameState.topBarMessage = "💀 Game Over...";
        timer.pause();
        playSoundFx("death");
    }

    function onResize() {
        calculateDimensions();        
        draw();
    }

    // refresh canvas size and calculate tile dimensions to fit the window
    function calculateDimensions(){
        
        // resize canvas to fit width/height keeping the 16/9 ratio    
        var width = window.innerWidth;
        var height = window.innerHeight;
        var ratio = width/height;    

        if(ratio >= 16/9){        
            canvas.height = height * PIXEL_RATIO;
            canvas.width = height * 16/9 * PIXEL_RATIO;        
            canvas.style.height = (height)+"px"
            canvas.style.width = (height * 16/9)+"px";
        }else{                       
            canvas.width = width * PIXEL_RATIO;
            canvas.height = width * 9/16 * PIXEL_RATIO;        
            canvas.style.width = (width)+"px"
            canvas.style.height = (width * 9/16)+"px";
        }

        gameState.ratio = canvas.height / canvas.width;
        gameState.tileWidth = canvas.width / MAX_X * 1.8;
        gameState.tileHeight = gameState.tileWidth * gameState.ratio * 1.8;
        gameState.tileThickness = gameState.tileWidth / 6 * gameState.ratio;    

        preRenderTiles();

        preRenderCanvas.width = canvas.width;
        preRenderCanvas.height = canvas.height;
    }

    function preRenderTiles(){
        preRenderedTiles["default"] = renderEmptyTile("#e8e6dc", gameState.tileWidth, 
            gameState.tileHeight, gameState.tileThickness);
        
        preRenderedTiles["selected"] = renderEmptyTile("#ff7b00", gameState.tileWidth, 
            gameState.tileHeight, gameState.tileThickness);
        
        preRenderedTiles["hover"] = renderEmptyTile("#F5F5F5", gameState.tileWidth, 
            gameState.tileHeight, gameState.tileThickness);

        preRenderedTiles["hint"] = renderEmptyTile("#eb5454", gameState.tileWidth, 
            gameState.tileHeight, gameState.tileThickness);
    }

    function update() {
        if(gameState && gameState.isRunning){

            updateCursorTile();           
            
            // tile removal animation            
            gameState.tiles.filter((t) => t.removed && t.alpha > 0).forEach((tile) => {
                tile.alpha = tile.alpha - 0.1;
                if (tile.alpha < 0.01) {
                    tile.alpha = 0;
                }        
            });
        
            // decrease combo counter
            if(comboTimer > 0){
                comboTimer -= 1000 / Loop.fps;
                if(comboTimer <= 0){
                    comboTimer = 0;                    
                    if(comboCount >= 1){
                        SOUND_FX["boom"].play();
                    }
                    comboCount = 0; 
                    document.getElementById("combo").className = "animatedHidden";                   
                }
            }            
        }

        TweenManager.update();
    }

    function setupTileForWinAnimation(tile,down=true){
        tile.removed = false;
        tile.alpha = 1.0;        
        TweenManager.addTween(new Tween({
            obj:tile,
            key:"y",
            initialValue: down ? 0 : MAX_Y+1,
            endValue: tile.y,
            durationMs: 600*(down ? 1-(tile.y/MAX_Y) : tile.y/MAX_Y),
            type: TweenType.EASE_IN_OUT            
        }).start());   
    }

    function draw() {
        
        if(gameState && gameState.isRunning){

            // uses a hidden canvas as a double buffer
            preRenderContext.resetTransform();
            preRenderContext.globalAlpha = 1.0;
            preRenderContext.clearRect(0, 0, canvas.width, canvas.height);            
            
            // tiles
            var tileWidth = gameState.tileWidth;
            var tileHeight = gameState.tileHeight;
            var tileThickness = gameState.tileThickness;
            gameState.tiles.forEach((tile) => {                        
                if (tile.alpha > 0) {

                    preRenderContext.globalAlpha = tile.alpha;                    
                
                    // translate to the tile position
                    var pZ = (tile.z + 1) * tileThickness;
                    var pX = tile.x * tileWidth / 2 + pZ;
                    var pY = tile.y * tileHeight / 2 + pZ;
                    
                    var preRenderedTile = preRenderedTiles["default"];
                    if (tile == gameState.selectedTile) {
                        preRenderedTile = preRenderedTiles["selected"];
                    } else if (tile == gameState.cursorTile) {
                        preRenderedTile = preRenderedTiles["hover"];                        
                    } else if (gameState.hint && gameState.hint.includes(tile)) {
                        preRenderedTile = preRenderedTiles["hint"];                        
                    }
                                            
                    preRenderContext.drawImage(preRenderedTile, pX-tileWidth/2, pY-tileHeight/2);
                    
                    // tile image
                    preRenderContext.drawImage(TILES_TYPES[tile.tileType].image, pX + tileWidth/4, pY + tileHeight/4, tileWidth/1.5, tileHeight/1.5);
                }
            });
            
            // draw final result from hidden canvas on the visible context (double buffer)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(preRenderCanvas, 0, 0, preRenderCanvas.width, preRenderCanvas.height);

            // ellapsed time        
            var secs = Math.round(timer.getEllapsedMillliseconds()/1000);
            document.getElementById("time").innerText = "🕑 "+secs+" s";        

            // moves left / congrats / gameover
            document.getElementById("moves").innerText = gameState.topBarMessage;
            
            // combo             
            var width = Math.round(comboTimer/MAX_COMBO_TIME*100);
            document.getElementById("comboBar").style.width = width+"%";
            document.getElementById("comboText").innerText = comboCount > 0 ? "Combo +"+comboCount : "";                                         
        }
    }

    function clearSelected() {
        gameState.selectedTile = undefined;    
        gameState.hint = [];    
    }

    // hide address bar on mobile
    setTimeout(() => window.scrollTo(0, 1), 50);

    // canvas
    var canvas = document.getElementById("canvas");
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseout", onMouseOut);
    canvas.addEventListener("touchstart", onMouseDown);    
    window.addEventListener("resize", onResize);
    calculateDimensions();

    // 2d context
    var ctx = canvas.getContext("2d");    

    var loader = document.getElementById("loader");
    var container = document.getElementById("container")

    var btnNewGame = document.getElementById("btnNewGame");
    btnNewGame.addEventListener("click", () => {    
        modal.show({
            headerContent: "New Game",
            bodyContent: "Restart the game and shuffe the tiles?",
            okCallback: (modal) => {                
                playSoundFx("click");
                modal.hide(); 
                startNewGame();                
            }
        });
    });

    var btnUndo = document.getElementById("btnUndo");
    btnUndo.addEventListener("click", () => {    
        if(!gameState.hasWon && gameState.board.undoLastMove()){                    
            timer.startOrResume();
            gameState.undos += 1;
            playSoundFx("horn");    
            clearSelected();
            updateMovesLeft();
        }
    });
    
    var btnHint = document.getElementById("btnHint");
    btnHint.addEventListener("click", () => {                    
        gameState.hint = gameState.solver.getBestNextMove();        
        if(gameState.hint){
            gameState.hints += 1; 
            playSoundFx("ah");
        }        
    });

    var btnSound = document.getElementById("btnSound")
    btnSound.addEventListener("click", () => {                    
        gameState.soundOn = !gameState.soundOn;        
        document.getElementById("btnSound").innerText = gameState.soundOn ? "Sound Off" : "Sound On";
        if(gameState.soundOn){
            playSoundFx("click");
        }
    });

    var btnRanking = document.getElementById("btnRanking");
    btnRanking.addEventListener("click", () => {                                    
        showRanking();
        playSoundFx("click");               
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            timer.pause();
            console.log("Pausing...");
            if(!gameState.hasWon){
                lastGameData.gameState = gameState;
                lastGameData.ellapsedMillliseconds = timer.getEllapsedMillliseconds();                        
                mahjongData.saveGameData(lastGameData);
            }
        } else {
            timer.startOrResume();
            console.log("Resuming...");
        }
    });
    
    function startNewGame() {
        showLoader();
        setTimeout(() => {            
            initGameWithClassicDisposition();
            hideLoader(); 
            enableButtons();           
        },50);        
    }

    function resumeLastGame() {
        gameState = lastGameData.gameState;
        gameState.isRunning = true;  
        calculateDimensions();
        console.log("last game time",lastGameData.ellapsedMillliseconds);
        timer.startOrResume(lastGameData.ellapsedMillliseconds);                        
        timer.pause();
    }

    function disableButtons() {
        var buttons = [btnHint, btnNewGame, btnRanking, btnSound, btnUndo];
        buttons.forEach((button) => button.disabled = true);
    }

    function enableButtons() {
        var buttons = [btnHint, btnNewGame, btnRanking, btnSound, btnUndo];
        buttons.forEach((button) => button.disabled = false);
    }

    function showLoader() {
        loader.className = "animatedVisible";
        container.className = "animatedHidden";
    }

    function hideLoader() {
        loader.className = "animatedHidden";
        container.className = "animatedVisible";
    }

    function loadAndRun() {
               
        var loadingTiles = Object.values(TILES_TYPES).filter((t) => t.loaded != true);
        var loadingSoundFxs = Object.values(SOUND_FX).filter((s) => s.loaded != true);
        
        if(loadingTiles.length + loadingSoundFxs.length > 0){
            // keeps loading...
            setTimeout(loadAndRun, 100);        
        }else{
            Loop.run({ draw: draw, update: update });
            
            // check if there's a ongoing game to be resumed                               
            lastGameData = mahjongData.loadGameData();    
            if(lastGameData.gameState && lastGameData.gameState.board 
                && !lastGameData.gameState.board.hasFinished()){                
                hideLoader();
                modal.show({
                    headerContent: "Resume",
                    bodyContent: "Do you want to resume the last game?",
                    okButtonText: "Yes",
                    cancelButtonText: "No",
                    okCallback: (modal) => {                                    
                        resumeLastGame();
                        modal.hide();
                    },
                    cancelCallback: (modal) => {
                        startNewGame();
                        modal.hide();
                    }
                });
            }else{                
                startNewGame();        
            }                     
        }
    }
        
    loadAndRun();
}

