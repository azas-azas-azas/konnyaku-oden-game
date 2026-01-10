export class Stage2 extends Phaser.Scene {
    constructor() {
        super({ key: 'Stage2' });

        this.scrollSpeed = 600;
        this.floorHeight = 120;

        this.maxJumps = 3;   // ★ 最大ジャンプ回数（2で二段ジャンプ）
        this.jumpCount = 0;  // ★ 今、何回目のジャンプか
        this.wasOnGround = false; // 前のフレームで地面についていたか

        // ★ ステージ進行管理
        this.distance = 0;      // どれだけ進んだか（スクロール距離）
        this.phase = 'early';   // 'early' | 'middle' | 'late' （とりあえず3段階）

        // ★ HP 関連
        this.maxHp = 100;
        this.hp = this.maxHp;

        // ★ 追加：ゲームオーバーフラグ
        this.isGameOver = false;        
    }

    preload() {
        this.load.image('hero_left', 'assets/hero_left.png');
        this.load.image('hero_right', 'assets/hero_right.png');

        // カッター
        this.load.image('cutter', 'assets/cutter.png');

        // 段ボール
        this.load.image('box', 'assets/box.png');
        this.load.image('box_open', 'assets/box_open.png');

        // 赤いカッター
        this.load.image('cutter_red', 'assets/cutter_red.png');

        // 火花パーティクル・蒸気パーティクル
        this.load.image('spark', 'assets/spark.png');
        this.load.image('steam', 'assets/steam.png');

        this.load.image('tako', 'assets/tako.png');
        this.load.image('bosstako', 'assets/bosstako.png');

        this.load.image('energy', 'assets/energy.png');        
    }

    create() {
        // ★ 追加：ゲームオーバーフラグを毎回リセット
        this.isGameOver = false;
        this.isCleared = false;

        // ★ これを追加：ボス戦状態を必ず初期化
        this.bossSpawned = false;
        this.isBossFight = false;
        this.boss = null;

        // ★ 追加：ボスが去った後の着地待ちフラグ
        this.waitingForLanding = false;        

        // ★ GAME OVER で physics.pause() しているので念のため復帰
        this.physics.resume();

        // ★ 予約イベント参照もリセット（保険）
        this.nextObstacleEvent = null;

        // ★ここを追加：ステージ進行をリセット
        this.distance = 0;
        this.phase = 'early';

        // ついでに、挙動が怪しいならここもリセット（任意）
        this.jumpCount = 0;
        this.wasOnGround = false;

        const width = this.scale.width;
        const height = this.scale.height;

        this.groundY = height - this.floorHeight + 2;   // 地面のY座標（見た目微調整分込み）

        this.isCleared = false;

        // ===== 床テクスチャ作成 =====
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x555555, 1);
        g.fillRect(0, 0, 128, this.floorHeight);

        g.lineStyle(6, 0xaaaaaa, 1);
        for (let x = 0; x < 128; x += 32) {
            g.beginPath();
            g.moveTo(x, 0);
            g.lineTo(x, this.floorHeight);
            g.strokePath();
        }
        g.generateTexture('floor', 128, this.floorHeight);
        g.destroy();

        // ===== 見た目の床 =====
        this.floor = this.add
            .tileSprite(
                0,
                height - this.floorHeight,
                width,
                this.floorHeight,
                'floor'
            )
            .setOrigin(0, 0);

        // ===== 当たり判定だけの床 =====
        const groundHeight = this.floorHeight;
        const groundRect = this.add.rectangle(
            width / 2,
            height - groundHeight / 2,
            width,
            groundHeight
        );
        groundRect.setVisible(false);
        this.physics.add.existing(groundRect, true);
        this.ground = groundRect;

        // ===== コンニャクいも =====
        this.hero = this.physics.add
            .sprite(80, this.groundY, 'hero_left') // X=80 に配置
            .setOrigin(0.5, 1)
            .setScale(0.07);

        this.hero.setCollideWorldBounds(true);
        this.hero.y = height - this.floorHeight + 2; // 見た目の微調整

        this.physics.add.collider(this.hero, this.ground);

        // 歩いている風アニメ
        this.heroAnimTimer = this.time.addEvent({
            delay: 200,
            loop: true,
            callback: () => {
                const currentKey = this.hero.texture.key;
                const nextKey =
                    currentKey === 'hero_left' ? 'hero_right' : 'hero_left';
                this.hero.setTexture(nextKey);
            },
        });

        // 回復アイテム
        this.items = this.physics.add.group({
            allowGravity: false,
            immovable: true,
            });

            // 2回だけ出すフラグ（restart対策）
            this.energySpawnedAtEarlyEnd = false;
            this.energySpawnedAtMiddleEnd = false;

            // hero と回復アイテムの当たり判定
            this.physics.add.overlap(
            this.hero,
            this.items,
            (hero, item) => this.onPickupEnergy(item),
            null,
            this
        );

        // ===== 障害物用テクスチャを作成 =====

        // ローラー（丸）
        {
            const rg = this.make.graphics({ x: 0, y: 0, add: false });
            rg.fillStyle(0xff4444, 1);
            rg.fillCircle(16, 16, 16); // 半径16 → 32x32
            rg.generateTexture('roller', 32, 32);
            rg.destroy();
        }

        // ピストン（縦長の棒）
        {
            const pg = this.make.graphics({ x: 0, y: 0, add: false });
            pg.fillStyle(0xffaa00, 1);
            pg.fillRect(0, 0, 24, 60); // 幅24, 高さ60 の棒
            pg.generateTexture('piston', 24, 60);
            pg.destroy();
        }

        // ===== 障害物グループ =====
        this.obstacles = this.physics.add.group({
            allowGravity: false,
        });

        // ヒット判定（とりあえずコンソールにログ）
        this.physics.add.overlap(
            this.hero,
            this.obstacles,
            this.onHitObstacle,
            null,
            this
        );

        this.scheduleNextObstacle();

        // 入力（ジャンプ）
        this.jumpKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );
        this.input.on('pointerdown', () => {
            this.tryJump();
        });

        // ★ HPゲージ
        this.hpBarWidth = 200;
        this.hpBarHeight = 12;

        // 背景バー（グレー）
        this.hpBarBg = this.add.rectangle(
            20, 50,
            this.hpBarWidth,
            this.hpBarHeight,
            0x666666
        ).setOrigin(0, 0.5).setScrollFactor(0);

        // 本体バー（赤）
        this.hpBar = this.add.rectangle(
            20, 50,
            this.hpBarWidth,
            this.hpBarHeight,
            0xff5555
        ).setOrigin(0, 0.5).setScrollFactor(0);

        // 枠（お好みで）
        this.hpBarFrame = this.add.rectangle(
            20, 50,
            this.hpBarWidth + 2,
            this.hpBarHeight + 2
        )
            .setOrigin(0, 0.5)
            .setStrokeStyle(2, 0x000000)
            .setFillStyle(0x000000, 0)
            .setScrollFactor(0);

        this.hp = this.maxHp;     // HP を満タンに戻す
        this.updateHpBar();       // ゲージを反映

        // 説明テキスト
        this.infoText = this.add.text(
            20,
            20,
            'Spaceキーでジャンプして障害物を避けよう！（3段ジャンプまで可能。栄養剤で回復）',
            { fontSize: '16px', color: '#000' , padding: { top: 6, bottom: 2 }}
         );

        // デバッグ表示
        this.debugText = this.add.text(10, 80, '', {
            fontSize: '16px',
            color: '#000',
        });

// デバッグ用：当たり判定を可視化
// this.physics.world.createDebugGraphic();

    }

    update(time, delta) {
        if (this.isGameOver || this.isCleared) {
            return; // 入力・移動など一切しない
        }

        const deltaSeconds = delta / 1000;

        // ===== 距離＆床スクロール =====
        this.floor.tilePositionX += this.scrollSpeed * deltaSeconds;

        // スクロールした分だけ距離を加算
        this.distance += this.scrollSpeed * deltaSeconds;

        // ===== フェーズ更新 =====
        if (this.distance < 10000) {
            this.phase = 'early';   // 前半
        } else if (this.distance < 25000) {
            this.phase = 'middle';  // 中盤
        } else {
            this.phase = 'late';    // 後半（ボスはこの先で追加予定）
        }

        // late終盤でボスタコを出す
        const bossTriggerDist = 45000;

        if (
            this.phase === 'late' &&
            !this.bossSpawned &&
            this.distance >= bossTriggerDist
        ) {
            this.bossSpawned = true;
            this.isBossFight = true;

            // 通常スポーン停止
            if (this.nextObstacleEvent) {
                this.nextObstacleEvent.remove(false);
                this.nextObstacleEvent = null;
            }

            this.spawnBossTako();
        }

        // ★ 修正：ボスが画面外に出たら「着地待ち」モードにする
        if (this.isBossFight && this.boss && !this.waitingForLanding) {
            const b = this.boss.getBounds();
            if (b.right < 0) {
                this.waitingForLanding = true; // 着地待ち開始
                
                // ボスはもう画面外なので消してOK
                this.boss.destroy(); 
                this.boss = null;
            }
        }

        // ★ 追加：着地待ちモードで、かつ地面にいたらクリア
        if (this.waitingForLanding) {
            // this.hero.body.blocked.down は「下方向が何かに接しているか」
            if (this.hero.body.blocked.down) {
                this.handleStageClear();
            }
        }
        const energyY = this.groundY - 70; // ローラーくらいの高さイメージ

        // early → middle の間（10000付近で1回）
        if (!this.energySpawnedAtEarlyEnd && this.distance >= 9800 && this.distance < 10200) {
            this.energySpawnedAtEarlyEnd = true;
            this.spawnEnergy(energyY);
        }

        // middle → late の間（25000付近で1回）
        if (!this.energySpawnedAtMiddleEnd && this.distance >= 24800 && this.distance < 25200) {
            this.energySpawnedAtMiddleEnd = true;
            this.spawnEnergy(energyY);
        }

        // ===== ジャンプ入力 =====
        if (Phaser.Input.Keyboard.JustDown(this.jumpKey)) {
            this.tryJump();
        }

        // 着地判定 → ジャンプ回数リセット
        const onGround = this.hero.body.blocked.down;
        if (onGround && !this.wasOnGround) {
            this.jumpCount = 0;
        }
        this.wasOnGround = onGround;

        // update() 内の「画面外の障害物削除」処理のところで回転も足す
        this.obstacles.children.iterate((obstacle) => {
            if (!obstacle) return;

            // ★ 修正：ボスなら勝手に削除しない（クリア判定まで残すため）
            if (this.boss && obstacle === this.boss) {
                return;
            }

            // 回転
            if (obstacle.spinSpeed) {
                obstacle.rotation += Phaser.Math.DegToRad(obstacle.spinSpeed);
            }

            // 画面外に出たら削除
            if (obstacle.x < -50) {
                obstacle.destroy();
            }
        });

        this.items.children.iterate((item) => {
            if (!item) return;
            if (item.x < -50) item.destroy();
        });

        // デバッグ表示（距離＆フェーズを表示すると楽しい）
        this.debugText.setText(
            'dist: ' + this.distance.toFixed(0) + '\nphase: ' + this.phase
        );
    }

    tryJump() {
        // ★ 最大回数に達していたらこれ以上ジャンプしない
        if (this.jumpCount >= this.maxJumps) {
            return;
        }

        this.hero.setVelocityY(-550); // ジャンプ力
        this.jumpCount += 1;
    }

    // ★ HPバーを現在値に合わせて更新
    updateHpBar() {
        const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
        this.hpBar.setDisplaySize(this.hpBarWidth * ratio, this.hpBarHeight);
    }

    // ★ 障害物ごとのダメージ量
    getDamageForObstacle(obstacle) {
        const key = obstacle.texture ? obstacle.texture.key : '';

        const damageEnabled = true; // 無敵モード用（デバッグ用）
        if (!damageEnabled) {
            return 0;
        }

        switch (key) {
            case 'bosstako':
                return this.maxHp;       // 巨大タコは即死

            case 'tako':
                return 10;               // 通常タコはちょい痛い

            case 'cutter_red':        // 赤いでかカッター → 半減
                  return this.maxHp * 0.33 ;

            case 'cutter':            // 通常カッター 
                return 8;

            case 'box':
            case 'box_open':          // 段ボール系
                return 6;

            case 'spark':             // 火花  
                return 4;

            case 'steam':             // 蒸気
                return 4;

            default:                  // その他はとりあえず少なめ
                return 0;
        }
    }

    // ★ 実際に HP を減らす処理
    applyDamage(amount) {
        if (amount <= 0 || this.hp <= 0) return;

        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;

        this.updateHpBar();

        if (this.hp <= 0) {
            this.handlePlayerDeath();
        }
    }

    onPickupEnergy(item) {
        if (!item || !item.active) return;

        item.destroy();

        // 最大HPの半分回復
        const healAmount = Math.floor(this.maxHp * 0.5);
        this.hp = Math.min(this.maxHp, this.hp + healAmount);

        this.updateHpBar();
    }

    // ★ HP0 になったときの処理（ひとまずステージ再スタート）
    handlePlayerDeath() {
        if (this.isGameOver) return;  // 多重実行防止
        this.isGameOver = true;

        // 物理を止める（敵・プレイヤーの動き停止）
        this.physics.pause();

        // ★スポーン停止
        if (this.nextObstacleEvent) {
        this.nextObstacleEvent.remove(false);
        this.nextObstacleEvent = null;
        }

        // プレイヤーをちょっと強調（赤くするなど）
        if (this.hero && this.hero.setTint) {
            this.hero.setTint(0xff0000);
        }

        // 画面中央にGAME OVER表示
        const { width, height } = this.scale;

        const gameOverText = this.add.text(width / 2, height / 2 - 20, 'GAME OVER', {
            fontSize: '40px',
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const retryText = this.add.text(width / 2, height / 2 + 20, 'Space または クリックでリトライ', {
            fontSize: '20px',
            color: '#000000'
        }).setOrigin(0.5);

        // 画面を少し暗くするオーバーレイ（お好み）
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.3)
            .setOrigin(0, 0)
            .setDepth(gameOverText.depth - 1); // テキストの下になるように

        // ★ リスタート処理を関数化（クリックとキーボード両方で使うため）
        const restartGame = () => {
            this.scene.restart();
        };

        // クリック or タップで再スタート
        this.input.once('pointerdown', restartGame);

        // ★ 追加：スペースキーでも再スタート
        this.input.keyboard.once('keydown-SPACE', restartGame);
    }

    // 共通：次の障害物出現をスケジュール
    scheduleNextObstacle() {
        // ★ゲームオーバーなら新規予約しない
        if (this.isGameOver || this.isCleared || this.isBossFight) return;

        const delay = Phaser.Math.Between(800, 1600);

        // ★前の予約が残っていたら消す（保険）
        if (this.nextObstacleEvent) {
            this.nextObstacleEvent.remove(false);
            this.nextObstacleEvent = null;
        }

        this.nextObstacleEvent = this.time.addEvent({
            delay,
            callback: () => {
            // ★発火時点でゲームオーバーなら何もしない
            if (this.isGameOver || this.isCleared || this.isBossFight) return;

            if (this.phase === 'early') {
                this.spawnEarlyPattern();
            } else if (this.phase === 'middle') {
                this.spawnMiddlePattern();
            } else {
                this.spawnLatePattern();
            }

            // ★次を予約
            this.scheduleNextObstacle();
            },
        });
    }

    handleStageClear() {
        if (this.isCleared) return;
        this.isCleared = true;

        // ボスを確実に無効化（当たり判定も止まる）
        if (this.boss) {
            this.boss.disableBody(true, true); // 物理OFF + 非表示
        }

        // 動きを止める
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

        this.input.once('pointerdown', () => {
        // 次のシーンがあるならここ
        // this.scene.start('Stage3');
        this.scene.restart(); // 仮：とりあえずリスタート
        });
    }

    // 共通：1個の障害物を生成するヘルパー
    spawnHazard(textureKey, minSpeed, maxSpeed, minScale, maxScale, yOffset = 0) {
        const width = this.scale.width;

        const speed = Phaser.Math.Between(minSpeed, maxSpeed);
        const scale = Phaser.Math.FloatBetween(minScale, maxScale);

        const obstacle = this.obstacles.create(
            width + 40,
            this.groundY + yOffset,
            textureKey
        );

        obstacle
            .setOrigin(0.5, 1)
            .setScale(scale)
            .setVelocityX(-speed);

        // spawnHazard の最後あたりに追記
        obstacle.spinSpeed = Phaser.Math.FloatBetween(4, 8); // 度/フレーム相当

        return obstacle;
    }

    spawnClosedBox() {
        const obstacle = this.spawnHazard(
            'box',
            250, 450,     // 速度
            0.1, 0.2    // スケール
        );

        obstacle.y = this.groundY;
        obstacle.spinSpeed = 0;

        return obstacle;
    }

    spawnOpenBox() {
        const obstacle = this.spawnHazard(
            'box_open',
            250, 450,      // 速度は同じでOK
            0.05, 0.15     // スケールで様子見
        );

        // 画像の高さ次第でちょっとだけYを調整してもいい
        obstacle.y = this.groundY;      // 必要なら -5 とか -8 足して微調整
        obstacle.spinSpeed = 0;

        return obstacle;
    }

    spawnRedCutter() {
//        const y = Phaser.Math.Between(300, 380);
        // 地面から 25px 〜 60px くらい上の高さをランダムにする
        const y = this.groundY - Phaser.Math.Between(25, 60);

        // 物理つきスプライトを生成
        const cutter = this.physics.add.sprite(900, y, 'cutter_red');

        // ★ 先にグループへ追加
        this.obstacles.add(cutter);

        // スケールを先に適用
        cutter.setScale(0.08);

        // --- 物理ボディ設定 ---
        // 一度リセット（超重要）
        cutter.body.setSize(1, 1);
        cutter.body.setOffset(0, 0);

        // ここで改めて正しい当たり判定を作る
        const radius = 30;
        cutter.body.setSize(radius * 2, radius * 2);
        cutter.body.setOffset(
            cutter.width / 2 - radius,
            cutter.height / 2 - radius 
        );

        // 衝突による停止を完全無効化
        cutter.setCollideWorldBounds(false);

        // --- 速度設定は一番最後 ---
        cutter.setVelocityX(-550);
        cutter.setAngularVelocity(1000);

        cutter.setDepth(5);
    }

    spawnMiddleBox() {
        const isOpen = Phaser.Math.FloatBetween(0, 1) < 0.2; // 20%くらいを開封箱に

        if (isOpen) {
            return this.spawnOpenBox();
        } else {
            return this.spawnClosedBox();
        }
    }

    // late用：Spark（火花）をローラー付近の高さで右→左に流す
    spawnSparkHazard() {
        const obstacle = this.spawnHazard(
            'spark',
            250, 450,       // 速度レンジ
            0.08, 0.15,     // スケールレンジ（大きければここを下げる）
            -40             // 地面より少し上（コンベア上あたりに調整）
        );

        obstacle.spinSpeed = 0; // くるくるしない

        // 50%の確率で点滅させる
        if (Phaser.Math.Between(0, 1) === 1) {
            this.addBlinkTween(obstacle);
        }

        return obstacle;
    }

    // late用：Smoke（蒸気）をローラー付近の高さで右→左に流す
    spawnSmokeHazard() {
        const obstacle = this.spawnHazard(
            'steam',
            250, 450,       // 速度レンジ
            0.08, 0.16,     // スケールレンジ
            -6.0             // Sparkより少し高めに
        );

        obstacle.spinSpeed = 0;

        if (Phaser.Math.Between(0, 1) === 1) {
            this.addBlinkTween(obstacle);
        }

        return obstacle;
    }

    // ★ 隠しキャラ：タコ（後半だけ登場）
    spawnTako() {
        // 他の障害物と同じように右から左へ流す
        const tako = this.spawnHazard(
            'tako',
            220, 260,       // 移動速度（少しゆっくり）
            0.1, 0.15,     // スケール（大きければここで調整）
            -10             // ローラー近くの高さ（お好みで調整）
        );

        // くるくる回らないように
        tako.spinSpeed = 0;

        // ぴょんぴょん跳ねる Tween
        this.tweens.add({
            targets: tako,
            y: tako.y - 60,         // 上に30pxジャンプ
            duration: 450,          // 上がるまでの時間
            yoyo: true,             // 戻る
            repeat: -1,             // ずっと繰り返す
            ease: 'Sine.easeInOut'  // ふわっとした動き
        });

        return tako;
    }

    spawnBossTako() {
        const tako = this.obstacles.create(
            this.scale.width + 80,
            this.groundY - 10,
            'bosstako'
        );

        tako.setOrigin(0.5, 1);
        tako.setScale(0.25);        // 巨大感
        tako.setVelocityX(-260);    // 少し遅め
        tako.setDepth(5);

        tako.body.setAllowGravity(false);
        tako.body.setImmovable(true);

        // 当たり判定は大きめ
        tako.body.setSize(
            tako.displayWidth * 0.8,
            tako.displayHeight * 0.9,
            true
        );

        this.boss = tako;
        return tako;
    }

    spawnEnergy(y) {
        if (this.isGameOver) return;

        const x = this.scale.width + 40;
        const item = this.items.create(x, y, 'energy');

        item.setDepth(6);
        item.setScale(0.12); // 見た目に合わせて調整

        item.body.setAllowGravity(false);
        item.setVelocityX(-this.scrollSpeed);

        // 取りやすいように当たり判定少し小さめ
        item.body.setSize(item.displayWidth * 0.7, item.displayHeight * 0.7, true);

        return item;
    }

    // ゆっくり点滅させる Tween
    addBlinkTween(target) {
        const duration = Phaser.Math.Between(400, 900);
        const delay = Phaser.Math.Between(0, 600);

        this.tweens.add({
            targets: target,
            alpha: { from: 1, to: 0.2 },  // ふわっと暗くなる
            ease: 'Sine.easeInOut',
            duration: duration,
            yoyo: true,
            repeat: -1,
            delay: delay
        });
    }

    // ぶつかったとき
    onHitObstacle(hero, obstacle) {
        if (!obstacle.active) return;

        const damage = this.getDamageForObstacle(obstacle);
        this.applyDamage(damage);

        // ★ 追加：ボスなら消滅させない（ボスはプレイヤーを通過していく）
        if (this.boss && obstacle === this.boss) {
            return;
        }        

        // とりあえず「1回当たったら消える」ようにする
        if (obstacle.disableBody) {
            obstacle.disableBody(true, true);
        } else {
            obstacle.destroy();
        }
    }



    // ★ 前半：カッターでジャンプ練習
    spawnEarlyPattern() {
        const r = Phaser.Math.Between(0, 1);

        if (r === 0) {
            // 通常カッター（回転あり）
            const cutter = this.spawnHazard(
                'cutter',
                300, 500,
                0.03, 0.1
            );
            cutter.spinSpeed = Phaser.Math.FloatBetween(4, 7); // 回転あり
        } else {
            // ミニカッター（回転なし）
            const mini = this.spawnHazard(
                'cutter',
                400, 600,
                0.01, 0.05
            );
            mini.spinSpeed = 0; // ★ 回転しない
        }
    }

    // ★ 中盤：コンベア上を流れる箱（ローラーを箱に見立てる or 後でテクスチャ差し替え）
    spawnMiddlePattern() {
        this.spawnMiddleBox();

        // 25%の確率で短い間隔で追加の箱を出す
        if (Phaser.Math.FloatBetween(0, 1) < 0.2) {
            this.time.addEvent({
                delay: Phaser.Math.Between(200, 400),
                callback: () => this.spawnMiddleBox()
            });
        }
    }
    
    // ★ 後半：高速ローラーゾーン ＋ Spark/Smoke 障害物
    spawnLatePattern() {
        // 7% くらいの確率で隠しタコ出現
        if (Phaser.Math.FloatBetween(0, 1) < 0.07) {
            this.spawnTako();
        }

        const r = Phaser.Math.FloatBetween(0, 1);

        if (r < 0.4) {
            // 40%：赤カッター（これまでどおり）
            this.spawnRedCutter();
        } else if (r < 0.7) {
            // 30%：火花（Spark）
            this.spawnSparkHazard();
        } else {
            // 30%：蒸気（Smoke）
            this.spawnSmokeHazard(); 
        }
    }

}
