import { TitleScene } from './TitleScene.js';
import { Stage1 } from './Stage1.js';
import { Stage2 } from './Stage2.js';
import { Stage3 } from './Stage3.js';
import { Stage4 } from './Stage4.js';
import { EndRoll } from './EndRoll.js';

const config = {
	type: Phaser.AUTO,
	width: 800,
	height: 600,
	physics: {
		default: 'arcade',
		arcade: { debug: false },
	},
	scene: [TitleScene, Stage1, Stage2, Stage3, Stage4, EndRoll], // ← 先頭がTitle
};

new Phaser.Game(config);
