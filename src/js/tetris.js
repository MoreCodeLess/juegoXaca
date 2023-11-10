class Game {
  static SQUARE_LENGTH = screen.width > 420 ? 30 : 20;
  static COLUMNS = 10;
  static ROWS = 20;
  static CANVAS_WIDTH = this.SQUARE_LENGTH * this.COLUMNS;
  static CANVAS_HEIGHT = this.SQUARE_LENGTH * this.ROWS;
  static EMPTY_COLOR = "#eaeaea";
  static BORDER_COLOR = "#ffffff";
  static DELETED_ROW_COLOR = "#d81c38";
  static TIMEOUT_LOCK_PUT_NEXT_PIECE = 300;
  static PIECE_SPEED = 300;
  static DELETE_ROW_ANIMATION = 500;
  static PER_SQUARE_SCORE = 1;
  static COLORS = [
    "#ffd300",
    "#de38c8",
    "#652ec7",
    "#33135c",
    "#13ca91",
    "#ff9472",
    "#35212a",
    "#ff8b8b",
    "#28cf75",
    "#00a9fe",
    "#04005e",
    "#120052",
    "#272822",
    "#f92672",
    "#66d9ef",
    "#a6e22e",
    "#fd971f",
  ];

  constructor(canvasId) {
    this.canvasId = canvasId;
    this.timeoutFlag = false;
    this.board = [];
    this.existingPieces = [];
    this.globalX = 0;
    this.globalY = 0;
    this.paused = true;
    this.currentFigure = null;
    this.sounds = {};
    this.canPlay = false;
    this.intervalId = null;
    this.init();
  }

  init() {
    this.showWelcome();
    this.initDomElements();
    this.resetGame();
    this.draw();
    this.initControls();
  }

  resetGame() {
    this.score = 0;
    this.initBoardAndExistingPieces();
    this.chooseRandomFigure();
    this.restartGlobalXAndY();
    this.syncExistingPiecesWithBoard();
    this.refreshScore();
    this.pauseGame();
  }

  showWelcome() {
    Swal.fire("Bienvenido");
  }

  initControls() {
    document.addEventListener("keydown", (e) => {
      const { code } = e;
      if (!this.canPlay && code !== "KeyP") {
        return;
      }
      switch (code) {
        case "ArrowRight":
          this.attemptMoveRight();
          break;
        case "ArrowLeft":
          this.attemptMoveLeft();
          break;
        case "ArrowDown":
          this.attemptMoveDown();
          break;
        case "KeyR":
          this.attemptRotate();
          break;
        case "KeyP":
          this.pauseOrResumeGame();
          break;
      }
      this.syncExistingPiecesWithBoard();
    });

    this.$btnDown.addEventListener("click", () => {
      if (!this.canPlay) return;
      this.attemptMoveDown();
    });
    this.$btnRight.addEventListener("click", () => {
      if (!this.canPlay) return;
      this.attemptMoveRight();
    });
    this.$btnLeft.addEventListener("click", () => {
      if (!this.canPlay) return;
      this.attemptMoveLeft();
    });
    this.$btnRotate.addEventListener("click", () => {
      if (!this.canPlay) return;
      this.attemptRotate();
    });
    [this.$btnPause, this.$btnResume].forEach(($btn) =>
      $btn.addEventListener("click", () => {
        this.pauseOrResumeGame();
      })
    );
  }

  attemptMoveRight() {
    if (this.figureCanMoveRight()) {
      this.globalX++;
    }
  }

  attemptMoveLeft() {
    if (this.figureCanMoveLeft()) {
      this.globalX--;
    }
  }

  attemptMoveDown() {
    if (this.figureCanMoveDown()) {
      this.globalY++;
    }
  }

  attemptRotate() {
    this.rotateFigure();
  }

  pauseOrResumeGame() {
    if (this.paused) {
      this.resumeGame();
      this.$btnResume.hidden = true;
      this.$btnPause.hidden = false;
    } else {
      this.pauseGame();
      this.$btnResume.hidden = false;
      this.$btnPause.hidden = true;
    }
  }

  pauseGame() {
    this.paused = true;
    this.canPlay = false;
    clearInterval(this.intervalId);
  }

  resumeGame() {
    this.refreshScore();
    this.paused = false;
    this.canPlay = true;
    this.intervalId = setInterval(this.mainLoop.bind(this), Game.PIECE_SPEED);
  }

  moveFigurePointsToExistingPieces() {
    this.canPlay = false;
    for (const point of this.currentFigure.getPoints()) {
      point.x += this.globalX;
      point.y += this.globalY;
      this.existingPieces[point.y][point.x] = {
        taken: true,
        color: point.color,
      };
    }
    this.restartGlobalXAndY();
    this.canPlay = true;
  }

  playerLoses() {
    for (const point of this.existingPieces[1]) {
      if (point.taken) {
        return true;
      }
    }
    return false;
  }

  getPointsToDelete = () => {
    const points = [];
    let y = 0;
    for (const row of this.existingPieces) {
      const isRowFull = row.every((point) => point.taken);
      if (isRowFull) {
        points.push(y);
      }
      y++;
    }
    return points;
  };

  changeDeletedRowColor(yCoordinates) {
    for (let y of yCoordinates) {
      for (const point of this.existingPieces[y]) {
        point.color = Game.DELETED_ROW_COLOR;
      }
    }
  }

  addScore(rows) {
    this.score += Game.PER_SQUARE_SCORE * Game.COLUMNS * rows.length;
    this.refreshScore();
  }

  removeRowsFromExistingPieces(yCoordinates) {
    for (let y of yCoordinates) {
      for (const point of this.existingPieces[y]) {
        point.color = Game.EMPTY_COLOR;
        point.taken = false;
      }
    }
  }

  verifyAndDeleteFullRows() {
    const yCoordinates = this.getPointsToDelete();
    if (yCoordinates.length <= 0) return;
    this.addScore(yCoordinates);
    this.changeDeletedRowColor(yCoordinates);
    this.canPlay = false;
    setTimeout(() => {
      this.removeRowsFromExistingPieces(yCoordinates);
      this.syncExistingPiecesWithBoard();
      const invertedCoordinates = Array.from(yCoordinates);
      // Now the coordinates are in descending order
      invertedCoordinates.reverse();

      for (let yCoordinate of invertedCoordinates) {
        for (let y = Game.ROWS - 1; y >= 0; y--) {
          for (let x = 0; x < this.existingPieces[y].length; x++) {
            if (y < yCoordinate) {
              let counter = 0;
              let auxiliarY = y;
              while (
                this.isEmptyPoint(x, auxiliarY + 1) &&
                !this.absolutePointOutOfLimits(x, auxiliarY + 1) &&
                counter < yCoordinates.length
              ) {
                this.existingPieces[auxiliarY + 1][x] =
                  this.existingPieces[auxiliarY][x];
                this.existingPieces[auxiliarY][x] = {
                  color: Game.EMPTY_COLOR,
                  taken: false,
                };

                this.syncExistingPiecesWithBoard();
                counter++;
                auxiliarY++;
              }
            }
          }
        }
      }

      this.syncExistingPiecesWithBoard();
      this.canPlay = true;
    }, Game.DELETE_ROW_ANIMATION);
  }

  mainLoop() {
    if (!this.canPlay) {
      return;
    }

    if (this.figureCanMoveDown()) {
      this.globalY++;
    } else {
      if (this.timeoutFlag) return;
      this.timeoutFlag = true;
      setTimeout(() => {
        this.timeoutFlag = false;

        if (this.figureCanMoveDown()) {
          return;
        }
        this.moveFigurePointsToExistingPieces();
        if (this.playerLoses()) {
          Swal.fire("Juego terminado", "Inténtalo de nuevo");
          this.canPlay = false;
          this.resetGame();
          return;
        }
        this.verifyAndDeleteFullRows();
        this.chooseRandomFigure();
        this.syncExistingPiecesWithBoard();
      }, Game.TIMEOUT_LOCK_PUT_NEXT_PIECE);
    }
    this.syncExistingPiecesWithBoard();
  }

  cleanGameBoardAndOverlapExistingPieces() {
    for (let y = 0; y < Game.ROWS; y++) {
      for (let x = 0; x < Game.COLUMNS; x++) {
        this.board[y][x] = {
          color: Game.EMPTY_COLOR,
          taken: false,
        };
        if (this.existingPieces[y][x].taken) {
          this.board[y][x].color = this.existingPieces[y][x].color;
        }
      }
    }
  }

  overlapCurrentFigureOnGameBoard() {
    if (!this.currentFigure) return;
    for (const point of this.currentFigure.getPoints()) {
      this.board[point.y + this.globalY][point.x + this.globalX].color =
        point.color;
    }
  }

  syncExistingPiecesWithBoard() {
    this.cleanGameBoardAndOverlapExistingPieces();
    this.overlapCurrentFigureOnGameBoard();
  }

  draw() {
    let x = 0,
      y = 0;
    for (const row of this.board) {
      x = 0;
      for (const point of row) {
        this.canvasContext.fillStyle = point.color;
        this.canvasContext.fillRect(
          x,
          y,
          Game.SQUARE_LENGTH,
          Game.SQUARE_LENGTH
        );
        this.canvasContext.restore();
        this.canvasContext.strokeStyle = Game.BORDER_COLOR;
        this.canvasContext.strokeRect(
          x,
          y,
          Game.SQUARE_LENGTH,
          Game.SQUARE_LENGTH
        );
        x += Game.SQUARE_LENGTH;
      }
      y += Game.SQUARE_LENGTH;
    }
    setTimeout(() => {
      requestAnimationFrame(this.draw.bind(this));
    }, 17);
  }

  refreshScore() {
    this.$score.textContent = `Score: ${this.score}`;
  }

  initDomElements() {
    this.$canvas = document.querySelector("#" + this.canvasId);
    this.$score = document.querySelector("#puntaje");
    this.$btnPause = document.querySelector("#btnPausar");
    this.$btnResume = document.querySelector("#btnIniciar");
    this.$btnRotate = document.querySelector("#btnRotar");
    this.$btnDown = document.querySelector("#btnAbajo");
    this.$btnRight = document.querySelector("#btnDerecha");
    this.$btnLeft = document.querySelector("#btnIzquierda");
    this.$canvas.setAttribute("width", Game.CANVAS_WIDTH + "px");
    this.$canvas.setAttribute("height", Game.CANVAS_HEIGHT + "px");
    this.canvasContext = this.$canvas.getContext("2d");
  }

  chooseRandomFigure() {
    this.currentFigure = this.getRandomFigure();
  }

  restartGlobalXAndY() {
    this.globalX = Math.floor(Game.COLUMNS / 2) - 1;
    this.globalY = 0;
  }

  getRandomFigure() {
    switch (Utils.getRandomNumberInRange(1, 7)) {
      case 1:
        return new Tetromino([
          [new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1)],
        ]);
      case 2:
        return new Tetromino([
          [new Point(0, 0), new Point(1, 0), new Point(2, 0), new Point(3, 0)],
          [new Point(0, 0), new Point(0, 1), new Point(0, 2), new Point(0, 3)],
        ]);
      case 3:
        return new Tetromino([
          [new Point(0, 1), new Point(1, 1), new Point(2, 1), new Point(2, 0)],
          [new Point(0, 0), new Point(0, 1), new Point(0, 2), new Point(1, 2)],
          [new Point(0, 0), new Point(0, 1), new Point(1, 0), new Point(2, 0)],
          [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(1, 2)],
        ]);
      case 4:
        return new Tetromino([
          [new Point(0, 0), new Point(0, 1), new Point(1, 1), new Point(2, 1)],
          [new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(0, 2)],
          [new Point(0, 0), new Point(1, 0), new Point(2, 0), new Point(2, 1)],
          [new Point(0, 2), new Point(1, 2), new Point(1, 1), new Point(1, 0)],
        ]);
      case 5:
        return new Tetromino([
          [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(2, 1)],
          [new Point(0, 1), new Point(1, 1), new Point(1, 0), new Point(0, 2)],
        ]);
      case 6:
        return new Tetromino([
          [new Point(0, 1), new Point(1, 1), new Point(1, 0), new Point(2, 0)],
          [new Point(0, 0), new Point(0, 1), new Point(1, 1), new Point(1, 2)],
        ]);
      case 7:
      default:
        return new Tetromino([
          [new Point(0, 1), new Point(1, 1), new Point(1, 0), new Point(2, 1)],
          [new Point(0, 0), new Point(0, 1), new Point(0, 2), new Point(1, 1)],
          [new Point(0, 0), new Point(1, 0), new Point(2, 0), new Point(1, 1)],
          [new Point(0, 1), new Point(1, 0), new Point(1, 1), new Point(1, 2)],
        ]);
    }
  }

  initBoardAndExistingPieces() {
    this.board = [];
    this.existingPieces = [];
    for (let y = 0; y < Game.ROWS; y++) {
      this.board.push([]);
      this.existingPieces.push([]);
      for (let x = 0; x < Game.COLUMNS; x++) {
        this.board[y].push({
          color: Game.EMPTY_COLOR,
          taken: false,
        });
        this.existingPieces[y].push({
          taken: false,
          color: Game.EMPTY_COLOR,
        });
      }
    }
  }

  relativePointOutOfLimits(point) {
    const absoluteX = point.x + this.globalX;
    const absoluteY = point.y + this.globalY;
    return this.absolutePointOutOfLimits(absoluteX, absoluteY);
  }

  absolutePointOutOfLimits(absoluteX, absoluteY) {
    return (
      absoluteX < 0 ||
      absoluteX > Game.COLUMNS - 1 ||
      absoluteY < 0 ||
      absoluteY > Game.ROWS - 1
    );
  }

  isEmptyPoint(x, y) {
    if (!this.existingPieces[y]) return true;
    if (!this.existingPieces[y][x]) return true;
    if (this.existingPieces[y][x].taken) {
      return false;
    } else {
      return true;
    }
  }

  isValidPoint(point, points) {
    const emptyPoint = this.isEmptyPoint(
      this.globalX + point.x,
      this.globalY + point.y
    );
    const hasSameCoordinateOfFigurePoint =
      points.findIndex((p) => {
        return p.x === point.x && p.y === point.y;
      }) !== -1;
    const outOfLimits = this.relativePointOutOfLimits(point);
    if ((emptyPoint || hasSameCoordinateOfFigurePoint) && !outOfLimits) {
      return true;
    } else {
      return false;
    }
  }

  figureCanMoveRight() {
    if (!this.currentFigure) return false;
    for (const point of this.currentFigure.getPoints()) {
      const newPoint = new Point(point.x + 1, point.y);
      if (!this.isValidPoint(newPoint, this.currentFigure.getPoints())) {
        return false;
      }
    }
    return true;
  }

  figureCanMoveLeft() {
    if (!this.currentFigure) return false;
    for (const point of this.currentFigure.getPoints()) {
      const newPoint = new Point(point.x - 1, point.y);
      if (!this.isValidPoint(newPoint, this.currentFigure.getPoints())) {
        return false;
      }
    }
    return true;
  }

  figureCanMoveDown() {
    if (!this.currentFigure) return false;
    for (const point of this.currentFigure.getPoints()) {
      const newPoint = new Point(point.x, point.y + 1);
      if (!this.isValidPoint(newPoint, this.currentFigure.getPoints())) {
        return false;
      }
    }
    return true;
  }

  figureCanRotate() {
    const newPointsAfterRotate = this.currentFigure.getNextRotation();
    for (const rotatedPoint of newPointsAfterRotate) {
      if (!this.isValidPoint(rotatedPoint, this.currentFigure.getPoints())) {
        return false;
      }
    }
    return true;
  }

  rotateFigure() {
    this.currentFigure.points = this.currentFigure.getNextRotation();
    this.currentFigure.incrementRotationIndex();
  }

  async askUserConfirmResetGame() {
    this.pauseGame();
    const result = await Swal.fire({
      title: "Reiniciar",
      text: "¿Quieres reiniciar el juego?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#fdbf9c",
      cancelButtonColor: "#4A42F3",
      cancelButtonText: "No",
      confirmButtonText: "Sí",
    });
    if (result.value) {
      this.resetGame();
    } else {
      this.resumeGame();
    }
  }
}

class Utils {
  static getRandomNumberInRange = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  static getRandomColor() {
    return Game.COLORS[Utils.getRandomNumberInRange(0, Game.COLORS.length - 1)];
  }

  static loadSound(src, loop) {
    const sound = document.createElement("audio");
    sound.src = src;
    sound.setAttribute("preload", "auto");
    sound.setAttribute("controls", "none");
    sound.loop = loop || false;
    sound.style.display = "none";
    document.body.appendChild(sound);
    return sound;
  }
}

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

class Tetromino {
  constructor(rotations) {
    this.rotations = rotations;
    this.rotationIndex = 0;
    this.points = this.rotations[this.rotationIndex];
    const randomColor = Utils.getRandomColor();
    this.rotations.forEach((points) => {
      points.forEach((point) => {
        point.color = randomColor;
      });
    });
    this.incrementRotationIndex();
  }

  getPoints() {
    return this.points;
  }

  incrementRotationIndex() {
    if (this.rotations.length <= 0) {
      this.rotationIndex = 0;
    } else {
      if (this.rotationIndex + 1 >= this.rotations.length) {
        this.rotationIndex = 0;
      } else {
        this.rotationIndex++;
      }
    }
  }

  getNextRotation() {
    return this.rotations[this.rotationIndex];
  }
}

const game = new Game("canvas");
document.querySelector("#reset").addEventListener("click", () => {
  game.askUserConfirmResetGame();
});
