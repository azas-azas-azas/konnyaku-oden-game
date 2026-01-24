import { BaseStage } from './BaseStage.js';

export class Stage1 extends BaseStage {

	// *******************
	// コンストラクタ
	// *******************
	constructor() {
		super('Stage1');
	}

	// *******************
	// preload
	// *******************
	preload() {
		const basePath = 'assets/';

		// 既存の石などの画像を追加
		this.load.image('rock1', basePath + 'rock1.png');
		this.load.image('rock2', basePath + 'rock2.png');
		this.load.image('rock3', basePath + 'rock3.png');
		this.load.image('rock4', basePath + 'rock4.png');
		this.load.image('rock5', basePath + 'rock5.png');
		this.load.image('rock6', basePath + 'rock6.png');

		// モグラ画像を追加
		this.load.image('mole_left',  basePath + 'mole_left.png');
		this.load.image('mole_right', basePath + 'mole_right.png');

		// ダンゴムシ画像を追加
		this.load.image('dangomusi_left',  basePath + 'dangomusi_left.png');
		this.load.image('dangomusi_right', basePath + 'dangomusi_right.png');

		// こんにゃくいも画像を追加
		this.load.image('hero_left', basePath + 'hero_left.png');
		this.load.image('hero_right', basePath + 'hero_right.png');

		// BGMを追加
		this.load.audio('bgm', 'assets/audio/Stage1-bgm.mp3');
		this.load.audio('explosion', 'assets/audio/explosion.mp3');
		this.load.audio('goal', 'assets/audio/goal.mp3');
	}

	// *******************
	// create
	// *******************
	create() {
		// ゲーム開始フラグ
		this.isGameStarted = false;

		// 背景色の設定
		this.cameras.main.setBackgroundColor('#87ceeb');

		// 共通キー設定
		this.setupCommonKeys();

		// --- State ---
		this.gameOver = false;
		this.cleared = false;

		// 地層背景
		this.drawSoilLayers();

		// トラップ（石画像）を配置
		this.traps = [];
		this.setupTraps(); // ※石の配置処理は見やすいように別関数に分けました（後述）

		// プレイヤーサイズ
		this.playerSize = 40;

		// プレイヤー配置
		this.player = this.add.sprite(400, 550, 'hero_left');
		this.player.setScale(0.03);

		// 入力
		this.cursors = this.input.keyboard.createCursorKeys();

		// アニメーション用変数
		this.playerAnimTimer = 0;
		this.playerAnimState = 0;

		// 敵の配列（初期化だけしておく）
		this.enemies = [];

		// ゴールライン
		this.goalLine = this.add.rectangle(400, 40, 800, 20, 0x00aa00); // 判定には使いませんが飾りとして

		// BGMを準備（まだ再生しない）
		this.bgm = this.sound.add('bgm', {
			loop: true,
			volume: 0.1,
		});

		// 爆発音（SE）
		this.explosionSe = this.sound.add('explosion', {
			loop: false,
			volume: 0.2,
		});

		// ゴールSE
		this.goalSe = this.sound.add('goal', {
			loop: false,
			volume: 0.2,
		});

		// オープニングを表示
		this.showOpening();
	}

	// オープニング（ストーリー）を表示する関数
	showOpening() {
		const { width, height } = this.scale;

		// 1. 背景を少し暗くする
		const overlay = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7)
			.setDepth(2000); // 最前面に

		// 2. ストーリーテキスト
		const storyText =
			"ある日、一塊のコンニャクイモが\n" +
			"土の中で目を覚ました。\n\n" +
			"「僕は……立派なおでんになりたい！」\n\n" +
			"まだ見ぬ地上（鍋）を目指して、\n" +
			"コンニャクの冒険が今、始まる――！";

		const textObj = this.add.text(width/2, height/2 - 20, storyText, {
			fontFamily: 'sans-serif',
			fontSize: '24px',
			color: '#ffffff',
			align: 'center',
			lineSpacing: 10
		}).setOrigin(0.5).setDepth(2001);

		// 3. 「Spaceでスタート」の点滅テキスト
		const startMsg = this.add.text(width/2, height - 80, 'Spaceキーでスタート', {
			fontFamily: 'monospace',
			fontSize: '20px',
			color: '#ffff00'
		}).setOrigin(0.5).setDepth(2001);

		// 点滅アニメーション
		this.tweens.add({
			targets: startMsg,
			alpha: 0,
			duration: 600,
			yoyo: true,
			repeat: -1
		});

		// 4. Spaceキー入力待ち（1回だけ反応）
		this.input.keyboard.once('keydown-SPACE', () => {
			// モーダル類を消す
			overlay.destroy();
			textObj.destroy();
			startMsg.destroy();

			// BGMスタート
			if (this.bgm && !this.bgm.isPlaying) {
				this.bgm.play();
			}

			// ゲーム本編を開始
			this.startGame();
		});
	}

	// ゲーム本編を開始する関数
	startGame() {
		this.isGameStarted = true;

		this.showStageBanner('Stage1：畑から脱出');
		this.showControls('←↑→↓ 移動 / R リスタート / T タイトル');

		// 敵の出現ループを開始（createから移動してきました）
		this.spawnEnemy(); // すぐ1匹

		this.time.addEvent({
			delay: 700,
			callback: () => {
				// ゲームオーバーやクリア時は出さない
				if (this.gameOver || this.cleared) return;

				const count = Phaser.Math.Between(1, 2);
				for (let i = 0; i < count; i++) {
					this.spawnEnemy();
				}
			},
			callbackScope: this,
			loop: true,
		});
	}

	// *******************
	// update
	// *******************
	update(time, delta) {
		// 共通キー処理
		this.updateCommonKeys();

		// ゲームが始まっていない、または終了していたら動かさない
		if (!this.isGameStarted || this.gameOver || this.cleared) return;

		const dt = delta / 1000;
		const speed = 70;  // プレイヤー移動速度

		let vx = 0;
		let vy = 0;
		let moving = false; // ← 動いているか判定

		// --- 入力処理 ---
		if (this.cursors.left.isDown) {
			vx = -speed;
			moving = true;
		} else if (this.cursors.right.isDown) {
			vx = speed;
			moving = true;
		}

		if (this.cursors.up.isDown) {
			vy = -speed;
			moving = true;
		} else if (this.cursors.down.isDown) {
			vy = speed;
			moving = true;
		}

		// --- 1) X方向の移動（衝突チェック付き） ---
		if (vx !== 0) {
			const nextX = this.player.x + vx * dt;
			const clampedX = Phaser.Math.Clamp(nextX, 20, 780);

			if (!this.collidesWithTraps(clampedX, this.player.y)) {
				this.player.x = clampedX;
			}
		}

		// --- 2) Y方向の移動（衝突チェック付き） ---
		if (vy !== 0) {
			const nextY = this.player.y + vy * dt;
			const clampedY = Phaser.Math.Clamp(nextY, 20, 580);

			if (!this.collidesWithTraps(this.player.x, clampedY)) {
				this.player.y = clampedY;
			}
		}

		// --- ▼主人公アニメーション（左右画像を交互に切り替える） ---
		if (moving) {
			// アニメーション用タイマーを進める
			this.playerAnimTimer += delta;

			// 0.15秒ごとに画像を切り替える
			if (this.playerAnimTimer > 150) {
				this.playerAnimTimer = 0;

				this.playerAnimState = 1 - this.playerAnimState;
				if (this.playerAnimState === 0) {
					this.player.setTexture('hero_left');
				} else {
					this.player.setTexture('hero_right');
				}
			}
		} else {
			// 止まっているときは左画像で固定
			this.player.setTexture('hero_left');
			this.playerAnimState = 0;
			this.playerAnimTimer = 0;
		}

		// プレイヤーの当たり判定はここで1回だけ計算
		const playerRect = this.getPlayerHitbox();

		// --- ▼敵の移動＆当たり判定 ---
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const enemy = this.enemies[i];
			enemy.x += enemy.vx * dt;

			// 画面外に出た敵を削除
			if (enemy.x < -80 || enemy.x > 880) {
				enemy.destroy();
				this.enemies.splice(i, 1);
				continue;
			}

			// 敵側も少し小さめの当たり判定にする
			const enemyRect = this.getEnemyHitbox(enemy);

			const damageEnabled = true; // 無敵モード用（★デバッグ用）

			if (Phaser.Geom.Intersects.RectangleToRectangle(
				enemyRect,
				playerRect
			)) {
				if (damageEnabled) {
					this.onHitEnemy();
					return;
				}
			}
		}

		// --- ゴール判定 ---
		if (this.player.y < 100) {
			this.onReachGoal();
		}
	}

	// --- 石の配置処理（createが長くなるので切り出し） ---
	setupTraps() {
		const rockKeys = ['rock1', 'rock2', 'rock3', 'rock4', 'rock5', 'rock6'];
		const rockScales = [0.08, 0.10, 0.12];

		const addTrap = (x, y) => {
			const key = Phaser.Utils.Array.GetRandom(rockKeys);
			const trap = this.add.image(x, y, key);
			trap.setOrigin(0.5, 0.5);
			trap.setScale(Phaser.Utils.Array.GetRandom(rockScales));
			this.traps.push(trap);
		};

		const layerYs = [490, 380, 370, 260, 150];
		const trapPlan = [
			{ y: layerYs[0], count: 1, ensureCenter: true },
			{ y: layerYs[1], count: 3, ensureCenter: true },
			{ y: layerYs[2], count: 2, ensureCenter: true },
			{ y: layerYs[3], count: 3, ensureCenter: true },
			{ y: layerYs[4], count: 6, ensureCenter: false },
		];

		const CENTER_X = 400;
		const CENTER_MARGIN = 40;

		trapPlan.forEach(layer => {
			for (let i = 0; i < layer.count; i++) {
				const x = Phaser.Math.Between(80, 720);
				addTrap(x, layer.y);
			}
			if (layer.ensureCenter) {
				const x = Phaser.Math.Between(CENTER_X - CENTER_MARGIN, CENTER_X + CENTER_MARGIN);
				addTrap(x, layer.y);
			}
		});
	}

	// ===================================
	// ヘルパーメソッド群
	// ===================================
	// 指定位置 (x, y) にプレイヤーが来たとき、石にぶつかるかどうか
	collidesWithTraps(x, y) {
		const size = this.playerSize || 40;
		const half = size / 2;

		// 「その位置にプレイヤーがいたとき」の当たり判定用の四角
		const playerRect = new Phaser.Geom.Rectangle(
			x - half,
			y - half,
			size,
			size
		);

		// すべての石（this.traps）とぶつかるかチェック
		for (const trap of this.traps) {
			if (!trap) continue;

			if (Phaser.Geom.Intersects.RectangleToRectangle(
				playerRect,
				trap.getBounds()
			)) {
				return true; // どれか1つでも当たった
			}
		}

		return false; // どの石とも当たっていない
	}

	// 地層
	drawSoilLayers() {
		const layerHeight = 100;
		const colors = [0x8b4513, 0xa0522d, 0xcd853f, 0xf4a460, 0xdeb887];

		for (let i = 0; i < 5; i++) {
			const y = 600 - layerHeight * (i + 0.5);
			this.add.rectangle(400, y, 800, layerHeight, colors[i]);
		}
	}

	// 敵生成（モグラ＝下、虫＝上）
	spawnEnemy() {
		if (!this.isGameStarted || this.gameOver || this.cleared) return;

		// 左から来るか右から来るか
		const fromLeft = Phaser.Math.Between(0, 1) === 0;

		// モグラ or 虫 を 50% ずつで決める
		const isMole = Phaser.Math.Between(0, 1) === 0;
		const enemyScales = [0.02, 0.04, 0.06];

		let x = fromLeft ? -40 : 840;
		let y;
		let speed;

		let enemy;   // ←ここに共通で入れる

		if (isMole) {
			// モグラ：下の層
			y = Phaser.Math.Between(250, 500);
			speed = Phaser.Math.Between(180, 260);

			// 進行方向に顔を向ける
			const key = fromLeft ? 'mole_right' : 'mole_left';
			enemy = this.add.image(x, y, key);
			enemy.setOrigin(0.5, 0.5);

			enemy.setScale(Phaser.Utils.Array.GetRandom(enemyScales));

		} else {
			// 虫：上の層
			y = Phaser.Math.Between(150, 320);
			speed = Phaser.Math.Between(220, 320);

			// 進行方向に顔を向ける
			const key = fromLeft ? 'dangomusi_right' : 'dangomusi_left';
			enemy = this.add.image(x, y, key);
			enemy.setOrigin(0.5, 0.5);

			enemy.setScale(Phaser.Utils.Array.GetRandom(enemyScales));
		}

		// 共通設定：速度と種類
		enemy.vx = fromLeft ? speed : -speed;
		enemy.enemyType = isMole ? 'mole' : 'bug';

		this.enemies.push(enemy);

		console.log(
			'enemy created',
			enemy.enemyType,
			'at', x, y,
			'vx', enemy.vx
		);
	}

	// ゲームオーバー（敵に当たったとき）
	onHitEnemy() {
		if (this.gameOver || this.cleared) return;

		this.gameOver = true;

		// BGMを止める
		this.stopBgm();

		// 爆発音を1回鳴らす
		if (this.explosionSe) {
			this.explosionSe.play();
		}
		
		// ゲームオーバー表示
		this.showGameOver();
	}

	// クリア
	onReachGoal() {
		if (this.gameOver || this.cleared) return;

		this.cleared = true;

		// クリア時もBGM停止
		this.stopBgm();

		// ゴール音を1回だけ鳴らす
		if (this.goalSe) {
			this.goalSe.play();
		}

		// クリア表示
		this.showGameClear(1);

		this.time.delayedCall(5000, () => {
			this.scene.start('Stage2');
		});
	}

	// プレイヤー用の当たり判定（見た目より小さめ）
	getPlayerHitbox() {
		const b = this.player.getBounds();
		const scale = 0.7; // ← 当たり判定の縮小率（0.5〜0.8くらいで調整）

		const w = b.width * scale;
		const h = b.height * scale;

		return new Phaser.Geom.Rectangle(
			b.centerX - w / 2,
			b.centerY - h / 2,
			w,
			h
		);
	}

	// 敵用の当たり判定（少しだけ小さく）
	getEnemyHitbox(enemy) {
		const b = enemy.getBounds();
		const scale = 0.8; // ← 敵の当たり判定の縮小率

		const w = b.width * scale;
		const h = b.height * scale;

		return new Phaser.Geom.Rectangle(
			b.centerX - w / 2,
			b.centerY - h / 2,
			w,
			h
		);
	}
}
