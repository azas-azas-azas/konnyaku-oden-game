// Stage3.js
export class Stage3 extends Phaser.Scene {
	constructor() {
		super({ key: 'Stage3' });
	}

	preload() {
		this.load.image('hero_konnyaku', 'assets/hero_processed.png');
		this.load.image('basket', 'assets/basket.png'); // すでにあるなら確認用
	}

	create() {
		this.showStageBanner('Stage3：買い物カゴを避けろ');

		// 青空っぽい色
		this.cameras.main.setBackgroundColor('#87ceeb');

		// 操作説明表示
		this.showControls('←→ 移動 / R リスタート / T タイトル　【敵に当たらず60秒逃げ切れ！】');

		// 共通キー設定
		this.setupCommonKeys();

		// ===== 状態リセット =====
		this.isGameOver = false;
		this.isCleared = false;

		// タイマー（60秒生存）
		this.surviveMs = 60_000;
		this.startTime = this.time.now;

		// ===== 地面 =====
		const groundY = 520;
		this.ground = this.add.rectangle(400, groundY, 800, 80, 0x555555);
		this.physics.add.existing(this.ground, true); // static body

		// ===== 主人公（コンニャク） =====
		// キー 'hero_konnyaku' は仮
		this.hero = this.physics.add.sprite(120, groundY - 80, 'hero_konnyaku');
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
			if (this.isInvincible) {
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

		// ===== スポーン制御（わちゃわちゃ感） =====
		// 最初はゆっくり → 徐々に頻度UP
		this.spawnDelay = 1500;     // 初期の間隔(ms)
		this.spawnDelayMin = 500;  // 下限
		this.spawnStep = 80;       // 1回ごとの短縮
		this.spawnEvent = this.time.addEvent({
			delay: this.spawnDelay,
			loop: true,
			callback: () => this.spawnBasket(),
		});

		// クリック/タップでリトライ（GameOver時） / 次へ（Clear時）
		this.input.on('pointerdown', () => {
		  if (this.isGameOver) this.scene.restart();
		  if (this.isCleared) this.scene.start('Stage4'); // Stage4が無ければ restart でもOK
		});

		// ===== デバッグ用：Iキーで無敵切り替え =====
		this.isInvincible = false; // 初期状態は無敵じゃない

/*		this.input.keyboard.on('keydown-I', () => {
			this.isInvincible = !this.isInvincible;
			
			if (this.isInvincible) {
				this.hero.setTint(0xff0000); // 無敵中は赤くする
				console.log('無敵モード: ON');
			} else {
				this.hero.clearTint();       // 元の色に戻す
				console.log('無敵モード: OFF');
			}
		});	*/
	}

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

		// ★ 30秒まではゆっくり
		if (elapsed < 30_000) {
			vy = Phaser.Math.Between(300, 600);
		} else {
			// ★ それ以降は元の速度
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

	update(time, delta) {
		// 共通キー処理
		this.updateCommonKeys();

		// 終了中は止める（見た目も挙動も固定）
		if (this.isGameOver || this.isCleared) {
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

	handleGameOver() {
		if (this.isGameOver || this.isCleared) return;
		this.isGameOver = true;

		// スポーン停止
		if (this.spawnEvent) this.spawnEvent.remove(false);

		// 物理停止
		this.physics.pause();

		// 表示
		this.add.text(400, 260, 'GAME OVER', {
			fontSize: '64px',
			color: '#000',
			fontStyle: 'bold',
		}).setOrigin(0.5);

		this.add.text(400, 320, 'クリック / タップ / Rキーでリトライ', {
			fontSize: '20px',
			color: '#000',
		}).setOrigin(0.5);
	}

	handleStageClear() {
		if (this.isGameOver || this.isCleared) return;
		this.isCleared = true;

		if (this.spawnEvent) this.spawnEvent.remove(false);
		this.physics.pause();

		// クリア表示
		const { width, height } = this.scale;
		this.add.text(width / 2, height / 2 - 20, 'CLEAR!', {
			fontSize: '48px',
			color: '#000',
			fontStyle: 'bold'
		}).setOrigin(0.5);

		this.add.text(width / 2, height / 2 + 20, 'クリック / タップで次へ', {
			fontSize: '20px',
			color: '#000'
		}).setOrigin(0.5);

		this.time.delayedCall(2000, () => {
			this.scene.start('Stage4');
		});
	}

	//--------------------------------------------
	// 共通部品（あとで外部モジュール化しても良い）
	//--------------------------------------------
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

		this.controlsText.setScrollFactor(0); // カメラが動いても固定
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
			this.scene.restart();
		}
		if (Phaser.Input.Keyboard.JustDown(this.keyT)) {
			this.goToTitle();
		}
	}

	goToTitle() {
		// TitleScene.js で設定している key: 'Title' に合わせる
		this.scene.start('Title');
	}    
}
