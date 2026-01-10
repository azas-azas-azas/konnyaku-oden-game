// ===== ステージ1（畑） =====
//import { Stage1 } from './Stage1.js';
//import { Stage2 } from './Stage2.js';
//import { Stage3 } from './Stage3.js';
import { Stage4 } from './Stage4.js';

// ===== ゲーム設定と起動 =====
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#87ceeb',
//    scene: [Stage1],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1000 }, // 全体の重力
            debug: false,
        },
    },
//    scene: [Stage2],
//    scene: [Stage3],
    scene: [Stage4],
};

const game = new Phaser.Game(config);
