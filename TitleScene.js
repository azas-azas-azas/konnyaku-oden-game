/**
 * TitleScene.js
 * 
 * タイトルシーン
 */
export class TitleScene extends Phaser.Scene {

	// *******************
	// コンストラクタ
	// *******************
	constructor() {
		super({ key: 'Title' });
	}

	// *******************
	// preload
	// *******************
	preload() {

		// BGMを追加
		this.load.audio('menuBgm', 'assets/audio/Menu-bgm.mp3');
	}

	// *******************
	// create
	// *******************
	create() {

		// スマホ判定（OS + タッチ）
		const isMobileLike =
			this.sys.game.device.os.android ||
			this.sys.game.device.os.iOS ||
			this.sys.game.device.os.iPad ||
			this.sys.game.device.input.touch;

		// メニューBGMを準備（まだ再生しない）
		this.menuBgm = this.sound.add('menuBgm', {
			loop: true,
			volume: 0.1,
		});

		// スマホではオート再生しない（PCだけ鳴らす）
		if (!isMobileLike) {
			this.menuBgm.play();
		}

		// TitleScene の create() 内イメージ
		this.add.text(400, 140, 'ROAD TO ODEN', {
			fontFamily: 'sans-serif',
			fontSize: '64px',
			color: '#a89393',
			fontStyle: 'bold'
		}).setOrigin(0.5);

		// ボタン作成
		const makeBtn = (y, label, sceneKey) => {
			const t = this.add.text(400, y, label, {
				fontSize: '28px',
				color: '#000',
				backgroundColor: '#fff'
			})
			.setOrigin(0.5)
			.setPadding(10);

			// スマホなら「非アクティブ化」して見た目も薄く
			if (isMobileLike) {
				t.setAlpha(0.4);
				// setInteractiveしないので、押しても反応しない
				return t;
			}

			// PCだけ押せる
			t.setInteractive({ useHandCursor: true });
			t.on('pointerdown', () => {
				if (this.menuBgm && this.menuBgm.isPlaying) this.menuBgm.stop();
				this.scene.start(sceneKey);
			});

			return t;
		};

		makeBtn(260, 'START（Stage1）', 'Stage1');
		makeBtn(320, 'Stage2から', 'Stage2');
		makeBtn(380, 'Stage3から', 'Stage3');
		makeBtn(440, 'Stage4から', 'Stage4');
//		makeBtn(500, 'END ROLL', 'EndRoll');	//for debug

		// スマホのときだけ案内を表示
		if (isMobileLike) {
			this.add.text(400, 520, 'このゲームはPC向けです。\nPCブラウザで開いてください。', {
				fontSize: '18px',
				color: '#ffffff',
				align: 'center'
			}).setOrigin(0.5);
		}
		
		// ユーザー操作でメニューBGMを停止
		const stopMenuBgm = () => {
			if (this.menuBgm && !this.menuBgm.isPlaying) {
				this.menuBgm.stop();
			}
		};

		// マウス / タップ
		this.input.once('pointerdown', stopMenuBgm);

		// キーボード
		this.input.keyboard.once('keydown', stopMenuBgm);
	}

	// *******************
	// ボタン作成共通関数
	// *******************
	makeButton(x, y, label, onClick, fontSize = 28) {
		const t = this.add.text(x, y, label, {
			fontFamily: 'monospace',
			fontSize: `${fontSize}px`,
			color: '#ffffff',
			backgroundColor: 'rgba(0,0,0,0.35)',
			padding: { left: 16, right: 16, top: 10, bottom: 10 },
		}).setOrigin(0.5).setInteractive({ useHandCursor: true });

		t.on('pointerover', () => t.setStyle({ backgroundColor: 'rgba(255,255,255,0.15)' }));
		t.on('pointerout', () => t.setStyle({ backgroundColor: 'rgba(0,0,0,0.35)' }));
		t.on('pointerdown', onClick);

		return t;
	}
}
