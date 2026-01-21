import { BaseStage } from './BaseStage.js';

export class Stage3 extends BaseStage {

	// *******************
	// コンストラクタ
	// *******************
	constructor() {
		super({ key: 'Stage3' });
	}

	// *******************
	// preload
	// *******************
	preload() {
		this.load.image('hero_konnyaku', 'assets/hero_processed.png');
		this.load.image('basket', 'assets/basket.png');
	}

	// *******************
	// create
	// *******************
	create() {
		// ★追加：ゲーム開始フラグ
		this.isGameStarted = false;

		// 背景色を設定
		this.cameras.main.setBackgroundColor('#87ceeb');

		// 共通キー設定
		this.setupCommonKeys();

		// ===== 状態リセット =====
		this.isGameOver = false;
		this.isCleared = false;

		// タイマー（60秒生存）
		this.surviveMs = 60_000;

		// ===== 地面 =====
		const groundY = 520;
		this.ground = this.add.rectangle(400, groundY, 800, 80, 0x555555);
		this.physics.add.existing(this.ground, true); // static body

		// ===== 主人公（コンニャク） =====
		// キー 'hero_konnyaku' は仮
		this.hero = this.physics.add.sprite(120, groundY - 50, 'hero_konnyaku');
		this.hero.setScale(0.03);
		this.hero.setCollideWorldBounds(true);
		this.hero.body.setSize(this.hero.width * 0.7, this.hero.height * 0.85, true);
		this.physics.add.collider(this.hero, this.ground);

		// ===== 入力（左右 + Spaceでリトライ） =====
		this.cursors = this.input.keyboard.createCursorKeys();
		this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

		// ===== 落下する買い物かご =====
		this.baskets = this.physics.add.group();

		// 主人公に当たったらゲームオーバー
		this.physics.add.overlap(this.hero, this.baskets, () => {
			// 無敵モードなら何もしないで帰る
			if (!this.damageEnabled) {
				return;
			}
			this.handleGameOver();
		});

		// ===== UI =====
		this.timerText = this.add.text(
			20, 44,
			'残り: 60.0s',
			{ fontSize: '18px', color: '#000', padding: { top: 6, bottom: 2 } }
		).setScrollFactor(0);

		// スポーンイベントの変数の初期値
		this.spawnDelay = 1500;
		this.spawnDelayMin = 500;
		this.spawnStep = 80;

		this.damageEnabled = false; // 無敵モード用（★デバッグ用）

		// オープニングへ
		this.showOpening();
	}

	// オープニング表示
	showOpening() {
		const { width, height } = this.scale;

		const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
			.setDepth(2000);

		const storyText =
			"コンニャクイモが目を覚ますと、\n" +
			"そこはスーパーマーケットだった！\n\n" +
			"「あれ？僕、もしかして……\n" +
			"コンニャクに加工されちゃったの！？」\n\n" +
			"次々と降ってくる買い物カゴを避け、\n" +
			"60秒間、売り場から逃げ続けろ！";

		const textObj = this.add.text(width / 2, height / 2 - 20, storyText, {
			fontFamily: 'sans-serif',
			fontSize: '24px',
			color: '#ffffff',
			align: 'center',
			lineSpacing: 10
		}).setOrigin(0.5).setDepth(2001);

		const startMsg = this.add.text(width / 2, height - 80, 'Spaceキーでスタート', {
			fontFamily: 'monospace',
			fontSize: '20px',
			color: '#ffff00'
		}).setOrigin(0.5).setDepth(2001);

		this.tweens.add({
			targets: startMsg,
			alpha: 0,
			duration: 600,
			yoyo: true,
			repeat: -1
		});

		this.input.keyboard.once('keydown-SPACE', () => {
			overlay.destroy();
			textObj.destroy();
			startMsg.destroy();
			this.startGame();
		});
	}

	// ゲーム開始処理
	startGame() {
		this.isGameStarted = true;

		// バナー表示
		this.showStageBanner('Stage3：買い物カゴを避けろ');
		this.showControls('←→ 移動 / R リスタート / T タイトル　【敵に当たらず60秒逃げ切れ！】');

		// タイマーの基準時間をセット
		this.startTime = this.time.now;

		// スポーンイベント開始
		this.spawnEvent = this.time.addEvent({
			delay: this.spawnDelay,
			loop: true,
			callback: () => this.spawnBasket(),
		});
	}

	// *******************
	// update
	// *******************
	update(time, delta) {
		// 共通キー処理
		this.updateCommonKeys();

		// 終了中は止める（見た目も挙動も固定）
		if (!this.isGameStarted || this.isGameOver || this.isCleared) {
			return;
		}

		// ===== 左右移動 =====
		const speed = 500;
		if (this.cursors.left.isDown) {
			this.hero.setVelocityX(-speed);
		} else if (this.cursors.right.isDown) {
			this.hero.setVelocityX(speed);
		} else {
			this.hero.setVelocityX(0);
		}

		// ===== タイマー（60秒生存でクリア） =====
		const elapsed = time - this.startTime;
		const remain = Math.max(0, this.surviveMs - elapsed);
		this.timerText.setText(`残り: ${(remain / 1000).toFixed(1)}s`);

		if (remain <= 0) {
			this.handleStageClear();
		}

		// 念のため、落ちっぱなし掃除（保険）
		this.baskets.getChildren().forEach((b) => {
			if (!b.active) return;
			if (b.y > 700) b.destroy();
		});
	}

	// ===================================
	// ヘルパーメソッド群
	// ===================================
	// 買い物かご出現
	spawnBasket() {
		if (this.isGameOver || this.isCleared) return;

		// 画面上からランダムXで落下
		const x = Phaser.Math.Between(60, 740);
		const y = -40;

		// キー 'basket' は仮
		const basket = this.physics.add.sprite(x, y, 'basket');
		basket.setScale(0.06);
		this.baskets.add(basket);

		// 経過時間（ms）
		const elapsed = this.time.now - this.startTime;

		let vy;

		// 30秒まではゆっくり
		if (elapsed < 30_000) {
			vy = Phaser.Math.Between(300, 600);
		} else {
			// それ以降は元の速度
			vy = Phaser.Math.Between(500, 900);
		}

		basket.setVelocity(0, vy);

		// ほんの少し横ブレ（面白さUP）
		const vx = Phaser.Math.Between(-40, 40);
		basket.setVelocityX(vx);

		basket.setCollideWorldBounds(false);

		// 地面に当たったら消す（重くならないように）
		this.physics.add.collider(basket, this.ground, () => {
			basket.destroy();
		});

		// 画面外に落ちたら消す
		basket.setData('bornAt', this.time.now);

		// 出現頻度を徐々に上げる（イベント自体を張り替える）
		this.spawnDelay = Math.max(this.spawnDelayMin, this.spawnDelay - this.spawnStep);
		if (this.spawnEvent && this.spawnEvent.delay !== this.spawnDelay) {
			this.spawnEvent.remove(false);
			this.spawnEvent = this.time.addEvent({
				delay: this.spawnDelay,
				loop: true,
				callback: () => this.spawnBasket(),
			});
		}
	}

	// ゲームオーバー処理
	handleGameOver() {
		if (this.isGameOver || this.isCleared) return;
		this.isGameOver = true;

		// スポーン停止
		if (this.spawnEvent) this.spawnEvent.remove(false);

		// 物理停止
		this.physics.pause();

		// 画面中央にGAME OVER表示
		this.showGameOver();
	}

	// ステージクリア処理
	handleStageClear() {
		if (this.isGameOver || this.isCleared) return;
		this.isCleared = true;

		if (this.spawnEvent) this.spawnEvent.remove(false);
		this.physics.pause();

		// クリア表示
		this.showGameClear(3);

		this.time.delayedCall(3000, () => {
			this.scene.start('Stage4');
		});
	}
}
