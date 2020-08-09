// # -> Walls, + -> Lava, @ -> Starting position of player, O -> Coin, = -> Block of lava that moves back and forth horizontally.
// | -> vertically moving blobs(lava), v -> dripping lava(only moves downwards).

let simpleLevelPlan = `
......................
..#................#..
..#..............=.#..
..#.........o.o....#..
..#.@......#####...#..
..#####............#..
......#++++++++++++#..
......##############..
......................`;

// Levels.
let Level = class Level {
  constructor(plan) {
    let rows = plan
      .trim()
      .split("\n")
      .map((l) => [...l]);

    this.height = rows.length;
    this.width = rows[0].length;
    this.startActors = [];

    this.rows = rows.map((row, y) => {
      return row.map((ch, x) => {
        let type = levelChars[ch]; // Moving characters/elements(actors).

        if (typeof type == "string") return type;

        this.startActors.push(type.create(new Vec(x, y), ch));
        return "empty";
      });
    });
  }
};

// Actor classes ===============================================================================================================
// Vec - for position and size of actors.
let Vec = class Vec {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  plus(other) {
    return new Vec(this.x + other.x, this.y + other.y);
  }

  // To get the distance travelled(speed vector/time interval).
  times(factor) {
    return new Vec(this.x * factor, this.y * factor);
  }
};

// Player. pos -> current speed.
let Player = class Player {
  constructor(pos, speed) {
    this.pos = pos;
    this.speed = speed;
  }

  get type() {
    return "player";
  }

  static create(pos) {
    // Because a player is one-and-a-half squares high, its initial position is set to be half a square above the position where the @ character appeared. This way, its bottom aligns with the bottom of the square it appeared in.
    return new Player(pos.plus(new Vec(0, -0.5)), new Vec(0, 0));
  }
};

// size stored in prototype because it is same for all instances of Player.
Player.prototype.size = new Vec(0.8, 1.5);

// Lava - To create appropriate lava character by looking at the character that Level constructor passes.
// pos -> co-ordinates of the character.
// ch -> character.
let Lava = class Lava {
  constructor(pos, speed, reset) {
    this.pos = pos;
    this.speed = speed;
    this.reset = reset;
  }

  get type() {
    return "lava";
  }

  // Looks at the character that is passed on from the level constructor and creates the lava accordingly.
  static create(pos, ch) {
    switch (ch) {
      case "=":
        return new Lava(pos, new Vec(2, 0));
      case "|":
        return new Lava(pos, new Vec(0, 2));
      case "v":
        return new Lava(pos, new Vec(0, 3), pos);
      default:
        return ch;
    }
  }
};

Lava.prototype.size = new Vec(1, 1);

// Coin.
//pos -> coin's actual position.
//basePos -> to track coin's vertical back and forth motion.
//wobble -> tracks phase of the bouncing motion.
let Coin = class Coin {
  constructor(pos, basePos, wobble) {
    this.pos = pos;
    this.basePos = basePos;
    this.wobble = wobble;
  }

  get type() {
    return "coin";
  }

  static create(pos) {
    let basePos = pos.plus(new Vec(0.2, 0.1));
    return new Coin(basePos, basePos, Math.random() * Math.PI * 2);
  }
};

Coin.prototype.size = new Vec(0.6, 0.6);

// State - to track running the state of running game.
let State = class State {
  constructor(level, actors, status) {
    this.level = level;
    this.actors = actors;
    this.status = status;
  }

  static start(level) {
    return new State(level, level.startActors, "playing");
  }

  get player() {
    return this.actors.find((a) => a.type == "player");
  }
};
// ========================================================================================================================xoxoxo==

// Characters in level.
let levelChars = {
  ".": "empty",
  "#": "wall",
  "+": "lava",
  "@": Player,
  o: Coin,
  "=": Lava,
  "|": Lava,
  v: Lava,
};

// Creating level instance.
let simpleLevel = new Level(simpleLevelPlan);
console.log(`${simpleLevel.width} by ${simpleLevel.height}`);

// Display =======================================================================================================================
// Creating an element and giving it some attributes and child nodes.
const scale = 20; //number of pixels that a single unit takes up on the screen.

function elt(name, attrs, ...children) {
  let dom = document.createElement(name);

  for (let attr of Object.keys(attrs)) {
    dom.setAttribute(attr, attrs[attr]);
  }

  for (let child of children) {
    dom.appendChild(child);
  }

  return dom;
}

let DOMDisplay = class DOMDisplay {
  constructor(parent, level) {
    this.dom = elt("div", { class: "game" }, drawGrid(level));
    this.actorLayer = null; //used to track the element that holds the actors so that they can be easily removed and replaced.
    parent.appendChild(this.dom);
  }

  clear() {
    this.dom.remove();
  }
};

function drawGrid(level) {
  return elt(
    //background is drawn as a table element because it corresponds to the structure of rows property of the level.
    "table",
    {
      class: "background",
      style: `width: ${level.width * scale}px`,
    },
    //each grid is turned into a tablw row.
    ...level.rows.map((row) =>
      elt(
        "tr",
        { style: `height: ${scale}px` },
        // strings in the grid are used as class names for the table cell elements.
        ...row.map((type) => elt("td", { class: type }))
      )
    )
  );
}

// Drawing actors.
function drawActors(actors) {
  return elt(
    "div",
    {},
    ...actors.map((actor) => {
      let rect = elt("div", { class: `actor ${actor.type}` });
      // multiplied by scale to go from game units to pixels.
      rect.style.width = `${actor.size.x * scale}px`;
      rect.style.height = `${actor.size.y * scale}px`;
      rect.style.left = `${actor.pos.x * scale}px`;
      rect.style.top = `${actor.pos.y * scale}px`;
      return rect;
    })
  );
}

// To make display show a given state.
DOMDisplay.prototype.syncState = function (state) {
  if (this.actorLayer) this.actorLayer.remove();
  this.actorLayer = drawActors(state.actors);
  this.dom.appendChild(this.actorLayer);
  this.dom.className = `game ${state.status}`;
  this.scrollPlayerIntoView(state);
};

// finding the players position and updating the wrapping element's scroll position.
DOMDisplay.prototype.scrollPlayerIntoView = function (state) {
  let width = this.dom.clientWidth;
  let height = this.dom.clientHeight;
  let margin = width / 3;

  // viewport: here we change the scroll position by manipulating that element's scrollLeft and scrollTop properties when player is too close to the edge.
  let left = this.dom.scrollLeft,
    right = left + width;
  let top = this.dom.scrollTop,
    bottom = top + height;

  let player = state.player;
  //finding the player's centre involves adding it's position and half it's size.
  // to get it in pixel coordinates we multiply the resulting vector by our display scale.
  let center = player.pos.plus(player.size.times(0.5)).times(scale);

  // verifies that the player position is isn't outside of the allowed range.
  if (center.x < left + margin) {
    this.dom.scrollLeft = center.x - margin;
  } else if (center.x > right - margin) {
    this.dom.scrollLeft = center.x + margin - width;
  }

  if (center.y < top + margin) {
    this.dom.scrollTop = center.y - margin;
  } else if (center.y > bottom - margin) {
    this.dom.scrollTop = center.y + margin - height;
  }
};
// =======================================================================================================================xoxoxo===

// Movements(actions)==============================================================================================================

Level.prototype.touches = function (pos, size, type) {
  let xStart = Math.floor(pos.x);
  let xEnd = Math.ceil(pos.x + size.x);
  let yStart = Math.floor(pos.y);
  let yEnd = Math.ceil(pos.y + size.y);

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      let isOutside = x < 0 || x >= this.width || y < 0 || y >= this.height;
      let here = isOutside ? "wall" : this.rows[y][x];
      if (here == type) return true;
    }
  }
  return false;
};

// State update method -> whether player is touching the lava.
// time -> time step.
// keys -> which keys are being held down.
State.prototype.update = function (time, keys) {
  let actors = this.actors.map((actor) => actor.update(time, this, keys));
  let newState = new State(this.level, actors, this.status);

  // if the game is already over, no further processing has to be done.
  if (newState.status != "playing") return newState;

  let player = newState.player;

  // testing if the player is touching the lava.
  if (this.level.touches(player.pos, player.size, "lava")) {
    return new State(this.level, actors, "lost");
  }

  // seeing if any other actors overlap the players if the game is still going on.
  for (let actor of actors) {
    if (actor != player && overlap(actor, player)) {
      newState = actor.collide(newState);
    }
  }
  return newState;
};

function overlap(actor1, actor2) {
  return (
    actor1.pos.x + actor1.size.x > actor2.pos.x &&
    actor1.pos.x < actor2.pos.x + actor2.size.x &&
    actor1.pos.y + actor1.size.y > actor2.pos.y &&
    actor1.pos.y < actor2.pos.y + actor2.size.y
  );
}

Lava.prototype.collide = function (state) {
  return new State(state.level, state.actors, "lost");
};

Coin.prototype.collide = function (state) {
  let filtered = state.actors.filter((a) => a != this);
  let status = state.status;
  if (!filtered.some((a) => a.type == "coin")) status = "won";
  return new State(state.level, filtered, status);
};

// actor updates.
Lava.prototype.update = function (time, state) {
  let newPos = this.pos.plus(this.speed.times(time));
  if (!state.level.touches(newPos, this.size, "wall")) {
    return new Lava(newPos, this.speed, this.reset);
  } else if (this.reset) {
    return new Lava(this.reset, this.speed, this.reset);
  } else {
    return new Lava(this.pos, this.speed.times(-1));
  }
};

const wobbleSpeed = 8;
const wobbleDist = 0.07;

Coin.prototype.update = function (time) {
  let wobble = this.wobble + time * wobbleSpeed;
  let wobblePos = Math.sin(wobble) * wobbleDist;
  return new Coin(
    this.basePos.plus(new Vec(0, wobblePos)),
    this.basePos,
    wobble
  );
};

const playerXSpeed = 7;
const gravity = 30;
const jumpSpeed = 17;

Player.prototype.update = function (time, state, keys) {
  // horizontal motion is computed based on the state of left and right arrow keys.
  let xSpeed = 0;
  if (keys.ArrowLeft) xSpeed -= playerXSpeed;
  if (keys.ArrowRight) xSpeed += playerXSpeed;
  let pos = this.pos;
  let movedX = pos.plus(new Vec(xSpeed * time, 0));
  if (!state.level.touches(movedX, this.size, "wall")) {
    //when there is no wall blocking, new position is created by this motion or else the old position is kept.
    pos = movedX;
  }

  let ySpeed = this.speed.y + time * gravity;
  let movedY = pos.plus(new Vec(0, ySpeed * time));
  if (!state.level.touches(movedY, this.size, "wall")) {
    pos = movedY;
  } else if (keys.ArrowUp && ySpeed > 0) {
    ySpeed = -jumpSpeed;
  } else {
    ySpeed = 0;
  }
  return new Player(pos, new Vec(xSpeed, ySpeed));
};

// tracking keys.
// storing the current state of the left, right and up arrow keys.
// an array of key names is given and will return an object that tracks the current position of those keys
function trackKeys(keys) {
  let down = Object.create(null);
  function track(event) {
    if (keys.includes(event.key)) {
      down[event.key] = event.type == "keydown"; //determines whether the key state should be updated to true  or false('keyup').
      event.preventDefault(); // to prevent accidental scrolling of the page.
    }
  }
  window.addEventListener("keydown", track);
  window.addEventListener("keyup", track);
  return down;
}

let arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"]);
// ========================================================================================================================xoxoxo==

// running the game.
function runAnimation(frameFunc) {
  let lastTime = null;
  function frame(time) {
    if (lastTime != null) {
      // the entire time in which page will be hidden until tab or window is showm again
      let timeStep = Math.min(time - lastTime, 100) / 1000;
      if (frameFunc(timeStep) === false) return;
    }
    lastTime = time;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function runLevel(level, Display) {
  let display = new Display(document.body, level);
  let state = State.start(level);
  // to let user sees what happened before clearing the display, stopping the animation and resolving the status to game's end status.
  let ending = 1;
  return new Promise((resolve) => {
    runAnimation((time) => {
      state = state.update(time, arrowKeys);
      display.syncState(state);
      if (state.status == "playing") {
        return true;
      } else if (ending > 0) {
        ending -= time;
        return true;
      } else {
        display.clear();
        resolve(state.status);
        return false;
      }
    });
  });
}

async function runGame(plans, Display) {
  for (let level = 0; level < plans.length; ) {
    let status = await runLevel(new Level(plans[level]), Display);
    if (status == "won") level++;
  }
  console.log("You have won!");
}
