const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers, deployments, getNamedAccounts } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('StrategyYearnV2: live', () => {
    before(async () => {
        let {
            DAI,
            deployer,
            T3CRV,
            timelock,
            treasury,
            USDC,
            unirouter,
            user,
            vault3crv,
            WETH,
            yvDAI
        } = await getNamedAccounts();
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [deployer]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [timelock]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [treasury]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [user]
        });
        const Manager = await deployments.get('yAxisMetaVaultManager');
        const Controller = await deployments.get('StrategyControllerV2');
        const Converter = await deployments.get('StableSwap3PoolConverter');
        const Strategy = await ethers.getContractFactory('StrategyYearnV2', deployer);
        this.deployer = await ethers.provider.getSigner(deployer);
        this.timelock = await ethers.provider.getSigner(timelock);
        this.treasury = await ethers.provider.getSigner(treasury);
        this.user = await ethers.provider.getSigner(user);
        this.vault = await ethers.getContractAt('yAxisMetaVault', vault3crv);
        this.controller = await ethers.getContractAt(
            'StrategyControllerV2',
            Controller.address,
            timelock
        );
        this.converter = Converter.address;
        this.t3crv = T3CRV;
        this.dai = DAI;
        this.usdc = USDC;
        await this.user.sendTransaction({
            to: this.deployer._address,
            value: ether('10')
        });
        await this.user.sendTransaction({
            to: this.timelock._address,
            value: ether('10')
        });
        await this.user.sendTransaction({
            to: this.treasury._address,
            value: ether('10')
        });

        this.strategy = await Strategy.deploy(
            'YearnV2: DAI',
            yvDAI,
            DAI,
            Converter.address,
            this.controller.address,
            Manager.address,
            WETH,
            unirouter
        );
        await this.strategy.deployed();
    });

    it('should add the strategy to the controller', async () => {
        await this.controller
            .connect(this.timelock)
            .addStrategy(
                this.t3crv,
                this.strategy.address,
                ether('5000000'),
                this.converter,
                false,
                84600
            );
    });

    it('should earn to the new strategy', async () => {
        await this.vault.connect(this.deployer).earn();
        const balance = await this.strategy.balanceOf();
        expect(balance).to.be.above(1);
    });

    it('should withdrawAll from strategy', async () => {
        await this.controller.connect(this.treasury).withdrawAll(this.strategy.address);
        const balance = await this.strategy.balanceOf();
        expect(balance).to.be.equal(0);
    });
});
