// BaseStage.js
export class BaseStage extends Phaser.Scene {
	constructor(key) {
		super(key);
	}

	// ステージ開始バナー表示
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

	// 操作説明表示
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

	// 共通キー設定（R: リスタート、T: タイトルへ）
	setupCommonKeys() {
		this.keyR = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.R
		);
		this.keyT = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.T
		);
	}

	updateCommonKeys() {
		if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
			this.stopBgm();
			this.scene.restart();
		}
		if (Phaser.Input.Keyboard.JustDown(this.keyT)) {
			this.stopBgm();
			this.goToTitle();
		}
	}

	goToTitle() {
		this.scene.start('Title'); // TitleScene の key に合わせる
	}

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

	showGameClear(stageNumber) {
		this.showResultMessage({
			text: `STAGE${stageNumber} CLEAR!`,
			color: '#08f586',
			fontSize: '48px',
		});
	}

	showGameOver() {
		this.showResultMessage({
			text: 'GAME OVER',
			color: '#fd6b6b',
			fontSize: '40px',
		});
	}

	// BGM停止（あれば止める）
	stopBgm() {
		if (this.bgm && this.bgm.isPlaying) {
			this.bgm.stop();
		}
	}

}
