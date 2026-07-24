import Game from "phaser/src/core/Game.js";
import Scene from "phaser/src/scene/Scene.js";
import DefaultPlugins from "phaser/src/plugins/DefaultPlugins.js";

import "phaser/src/events/EventEmitter.js";
import "phaser/src/cameras/2d/CameraManager.js";
import "phaser/src/gameobjects/GameObjectFactory.js";
import "phaser/src/gameobjects/DisplayList.js";
import "phaser/src/input/InputPlugin.js";
import "phaser/src/gameobjects/text/TextFactory.js";
import "phaser/src/gameobjects/shape/rectangle/RectangleFactory.js";

DefaultPlugins.Global = DefaultPlugins.Global.filter((plugin) => plugin !== "sound");
DefaultPlugins.CoreScene = [
  "EventEmitter",
  "CameraManager",
  "GameObjectFactory",
  "DisplayList",
];
DefaultPlugins.DefaultScene = [
  "InputPlugin",
];

const Phaser = {
  Game,
  Scene,
  CANVAS: 1,
  Scale: {
    FIT: 3,
    CENTER_BOTH: 1,
  },
};

export default Phaser;
