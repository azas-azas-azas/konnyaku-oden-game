/**
 * BaseStage.js
 * 
 * 各ステージの共通機能をまとめた基底クラス
 */
export class BaseStage extends Phaser.Scene {

	// *******************
	// コンストラクタ
	// *******************
	constructor(key) {
		super(key);
	}

	// *******************
	// 共通SEをまとめて読み込む
	// *******************
	preloadCommonAudio() {
		this.load.audio('explosion', 'assets/audio/explosion.mp3');
		this.load.audio('goal', 'assets/audio/goal.mp3');
		this.load.audio('damage', 'assets/audio/damage.mp3');
		this.load.audio('recovery', 'assets/audio/recovery.mp3');
		this.load.audio('bossvoice', 'assets/audio/boss-voice.mp3');
		this.load.audio('shot', 'assets/audio/shot.mp3');
	}

	// *******************
	// 共通のSE再生ヘルパー
	// *******************
	playSfx(key, config = {}) {
		this.sound.play(key, {
			volume: 0.2,   // 共通の標準音量
			...config,
		});
	}

	// *******************
	// ステージ開始バナー表示
	// *******************
	showStageBanner(text) {
		const { width } = this.scale;
		const t = this.add.text(width / 2, 60, text, {
			fontFamily: 'sans-serif',
			fontSize: '24px',
			color: '#ffffff',
			stroke: '#000000',
			strokeThickness: 6,
		}).setOrigin(0.5).setDepth(999);

		this.tweens.add({
			targets: t,
			alpha: 0,
			duration: 600,
			delay: 1200,
			onComplete: () => t.destroy(),
		});
	}

	// *******************
	// 操作説明表示
	// *******************
	showControls(text) {
		if (this.controlsText) this.controlsText.destroy();

		this.controlsText = this.add.text(16, 12, text, {
			fontFamily: 'sans-serif',
			fontSize: '18px',
			color: '#000',
			backgroundColor: '#ffffffcc',
			padding: { left: 10, right: 10, top: 6, bottom: 6 },
		}).setDepth(1000);

		this.controlsText.setScrollFactor(0);
	}

	// *******************
	// 共通キー設定（R: リスタート、T: タイトルへ）
	// *******************
	setupCommonKeys() {
		this.keyR = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.R
		);
		this.keyT = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.T
		);
	}

	// *******************
	// 共通キー処理更新（R: リスタート、T: タイトルへ）
	// *******************
	updateCommonKeys() {
		if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
			this.stopBgm();
			this.sound.stopAll();
			this.scene.restart();
		}
		if (Phaser.Input.Keyboard.JustDown(this.keyT)) {
			this.stopBgm();
			this.sound.stopAll();
			this.goToTitle();
		}
	}

	// *******************
	// タイトルへ戻る
	// *******************
	goToTitle() {
		this.scene.start('Title'); // TitleScene の key に合わせる
	}

	// *******************
	// 結果メッセージ表示（クリア・ゲームオーバー共通）
	// *******************
	showResultMessage({
		text,
		color,
		fontSize = '40px',
		overlayAlpha = 0.3,
	}) {
		const { width, height } = this.scale;

		// オーバーレイ（先に作る＝背面）
		this.add.rectangle(0, 0, width, height, 0x000000, overlayAlpha)
			.setOrigin(0, 0)
			.setDepth(9998);

		// メッセージテキスト
		this.add.text(width / 2, height / 2 - 20, text, {
			fontSize,
			color,
			fontStyle: 'bold',
		})
		.setOrigin(0.5)
		.setDepth(9999);
	}

	// *******************
	// ステージクリア表示
	// *******************
	showGameClear(stageNumber) {
		this.showResultMessage({
			text: `STAGE${stageNumber} CLEAR!`,
			color: '#08f586',
			fontSize: '48px',
		});
	}

	// *******************
	// ゲームオーバー表示
	// *******************
	showGameOver() {
		this.showResultMessage({
			text: 'GAME OVER',
			color: '#fd6b6b',
			fontSize: '40px',
		});
	}

	// *******************
	// BGM停止
	// *******************
	stopBgm() {
		if (this.bgm && this.bgm.isPlaying) {
			this.bgm.stop();
		}
	}

}
