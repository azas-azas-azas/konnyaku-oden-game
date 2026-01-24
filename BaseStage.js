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
	showControls(textForDesktop) {
		if (this.controlsText) this.controlsText.destroy();

		// PC かどうかを判定（setupCommonKeys が先に呼ばれていれば this.isMobile が入っている想定）
		const isMobile = this.isMobile ?? !this.sys.game.device.os.desktop;

		// 端末ごとに表示する文言を分岐
		const text = isMobile
			? '画面タップで移動 / 画面下のボタンでリスタート / タイトル'
			: textForDesktop;

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
		// 端末判定（create 中なので this.sys が使える）
		this.isMobile = !this.sys.game.device.os.desktop;

		// PC用：キーボード
		this.keyR = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.R
		);
		this.keyT = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.T
		);

		// スマホ用：画面下ボタン
		if (this.isMobile) {
			const { width, height } = this.scale;

			// タイトルへボタン（左下）
			this.titleButton = this.add.text(20, height - 60, 'タイトルへ', {
				fontFamily: 'sans-serif',
				fontSize: '20px',
				color: '#ffffff',
				backgroundColor: '#000000aa',
				padding: { left: 10, right: 10, top: 5, bottom: 5 },
			})
			.setDepth(1000)
			.setScrollFactor(0)
			.setInteractive();

			this.titleButton.on('pointerup', () => {
				this.stopBgm();
				this.goToTitle();
			});

			// リスタートボタン（右下）
			this.restartButton = this.add.text(width - 150, height - 60, 'リスタート', {
				fontFamily: 'sans-serif',
				fontSize: '20px',
				color: '#ffffff',
				backgroundColor: '#000000aa',
				padding: { left: 10, right: 10, top: 5, bottom: 5 },
			})
			.setDepth(1000)
			.setScrollFactor(0)
			.setInteractive();

			this.restartButton.on('pointerup', () => {
				this.stopBgm();
				this.scene.restart();
			});
		}
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
