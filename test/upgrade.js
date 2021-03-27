const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const erc20Abi = require('../abi/erc20');
const cTokenAbi = require('../abi/ctoken');
const cEtherAbi = require('../abi/cether');
const priceOracleAbi = require('../abi/priceOracle');
const priceOracleProxyAbi = require('../abi/priceOracleProxy');
const comptrollerAbi = require("../abi/comptroller");
const masterChefAbi = require("../abi/masterChef");

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

describe('crCakeLP', () => {
  const toWei = ethers.utils.parseEther;
  const MAX = ethers.constants.MaxUint256;
  const provider = waffle.provider;

  // Current totalAllocPoint of MasterChef is 39640.
  const allocPoint = 39640;
  // There are 111 pools in MasterChef.
  const pid = 111;

  let accounts;
  let admin, adminAddress;
  let user1, user1Address;
  let user2, user2Address;

  let clp;
  let crCLP;
  let masterChef;
  let unitroller;
  let cake;
  let crBNB;
  let priceOracleV1;
  let priceoracleProxy;

  const comptrollerAdminAddress = '0xc9e3eB04AAE820a1AA77789e699E7c433F75e216';
  const unitrollerAddress = '0x589DE0F0Ccf905477646599bb3E5C622C84cC0BA';
  const masterChefAddress = '0x73feaa1eE314F8c655E354234017bE2193C9E24E';
  const masterChefAdminAddress = '0xA1f482Dc58145Ba2210bC21878Ca34000E2e8fE4';
  const interestRateModelAddress = '0x4E4c96B038899e2F2597eF693b8278CfEb63e7DB';
  const cakeTokenAddress = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
  const crBNBAddress = '0x1Ffe17B99b439bE0aFC831239dDECda2A790fF3A';
  const priceOracleV1Address = '0x9cF84A3cBd5368bFC08412851c4f2015eE078c2f';
  const priceOracleProxyAddress = '0xC2E7fC53503eb419c8078d56895cb598c71177Dd';
  const pricePosterAddress = '0xd830A7413CB25FEe57f8115CD64E565B0Be466c3';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();
    user1 = accounts[1];
    user1Address = await user1.getAddress();
    user2 = accounts[2];
    user2Address = await user2.getAddress();

    cake = new ethers.Contract(cakeTokenAddress, erc20Abi, provider);

    const comptrollerAdmin = await ethers.provider.getSigner(comptrollerAdminAddress);
    const masterChefAdmin = await ethers.provider.getSigner(masterChefAdminAddress);
    const pricePoster = await ethers.provider.getSigner(pricePosterAddress);

    // Master chef contract admin is a timelock contract. Give it some ethers.
    await admin.sendTransaction({
      to: masterChefAdminAddress,
      value: ethers.utils.parseEther("1.0")
    });

    // 1. Deploy new Cake LP token.
    const slpFactory = await ethers.getContractFactory('CakeLP');
    clp = await slpFactory.deploy();

    // Distribute some clp tokens to user1, user2, and user3.
    await clp.approve(adminAddress, MAX);
    await clp.transfer(user1Address, toWei('100'));
    await clp.transfer(user2Address, toWei('100'));

    masterChef = new ethers.Contract(masterChefAddress, masterChefAbi, provider);

    // 2. Add CLP to MasterChef contract.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [masterChefAdminAddress]
    });

    await masterChef.connect(masterChefAdmin).add(allocPoint, clp.address, false);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [masterChefAdminAddress]
    });

    expect(await masterChef.poolLength()).to.equal(pid + 1);

    // 3. Deploy new crCLP contract.
    const delegateeFactory = await ethers.getContractFactory('CCakeLPDelegate');
    const cDelegatee = await delegateeFactory.deploy();

    const delegatorFactory = await ethers.getContractFactory('CErc20Delegator');
    const cDelegator = await delegatorFactory.deploy(
      clp.address,
      unitrollerAddress,
      interestRateModelAddress,
      toWei('1'),
      'crCLP Token',
      'crCLP',
      8,
      adminAddress,
      cDelegatee.address,
      encodeParameters(['address', 'uint'], [masterChefAddress, pid])
    );

    crCLP = new ethers.Contract(cDelegator.address, cTokenAbi, provider);
    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);
    crBNB = new ethers.Contract(crBNBAddress, cEtherAbi, provider);
    priceOracleV1 = new ethers.Contract(priceOracleV1Address, priceOracleAbi, provider);
    priceoracleProxy = new ethers.Contract(priceOracleProxyAddress, priceOracleProxyAbi, provider);

    // 4. Set CLP price.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [pricePosterAddress]
    });

    await priceOracleV1.connect(pricePoster).setPrice(clp.address, toWei('1'));
    expect(await priceoracleProxy.getUnderlyingPrice(crCLP.address)).to.equal(toWei('1'));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [pricePosterAddress]
    });

    // 5. Support crCLP market.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [comptrollerAdminAddress]
    });

    await unitroller.connect(comptrollerAdmin)._supportMarket(crCLP.address);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [comptrollerAdminAddress]
    });
  });

  it('mints and redeems', async () => {
    /*
     * rewards: 34 cake / blk (the rewards of pool 0 will be adjusted by adding new pool)
     *
     * blk  0          1          2          3          4          5          6
     *      |----------|----------|----------|----------|----------|----------|
     *                 |          |          |          |          |          |
     * user1       supply(10)     |          |      supply(10)     |      redeem(20)
     *                      (34)  |   (17)   |  (11.3)      (17)   |  (34)
     * cake           +0          |          |         +0          |         +0
     *                            |          |                     |
     * user2                  supply(10) supply(10)            redeem(20)
     *                                (17)      (22.6)      (17)
     * cake                      +0         +0                    +0
     */
    expect(await cake.balanceOf(user1Address)).to.equal(0);
    expect(await cake.balanceOf(user2Address)).to.equal(0);

    await clp.connect(user1).approve(crCLP.address, MAX);
    await clp.connect(user2).approve(crCLP.address, MAX);

    // User1 mints 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).mint(toWei('10'));
    expect(await cake.balanceOf(user1Address)).to.equal(0);

    // User2 mints 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).mint(toWei('10'));
    expect(await cake.balanceOf(user2Address)).to.equal(0);

    // User2 mints 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).mint(toWei('10'));
    expect(await cake.balanceOf(user1Address)).to.equal(0);

    // User1 mint1 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).mint(toWei('10'));
    expect(await cake.balanceOf(user1Address)).to.equal(0);

    // User2 redeems 20 CLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).redeemUnderlying(toWei('20'));
    expect(await cake.balanceOf(user1Address)).to.equal(0);

    // User1 redeems 20 CLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).redeemUnderlying(toWei('20'));
    expect(await cake.balanceOf(user1Address)).to.equal(0);

    expect(await crCLP.totalSupply()).to.equal(0);
    expect(await masterChef.pendingCake(pid, crCLP.address)).to.equal(0);

    await provider.send("evm_mine", []);
    await crCLP.connect(user1).claimCake(user1Address);
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).claimCake(user2Address);

    const user1Balance = await cake.balanceOf(user1Address);
    const user2Balance = await cake.balanceOf(user2Address);
    expect(Number(user1Balance)).to.closeTo(Number(user2Balance.mul(2)), 10 ** 10);
  });

  it('transfers tokens', async () => {
    /*
     * rewards: 34 cake / blk (the rewards of pool 0 will be adjusted by adding new pool)
     *
     * blk  0          1          2          3          4          5
     *      |----------|----------|----------|----------|----------|
     *                 |          |          |          |          |
     * user1       supply(10) transfer(10)   |       claim()       |
     *                      (34)       (0)   |    (0)              |
     * cake           +0                     |         +34         |
     *                                       |                     |
     * user2                             supply(10)             claim()
     *                                 (34)      (34)       (34)
     * cake                                 +0                   +102
     */
    expect(await cake.balanceOf(user1Address)).to.equal(0);
    expect(await cake.balanceOf(user2Address)).to.equal(0);

    await clp.connect(user1).approve(crCLP.address, MAX);
    await clp.connect(user2).approve(crCLP.address, MAX);

    // User1 mints 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).mint(toWei('10'));
    expect(await clp.balanceOf(user1Address)).to.equal(toWei('90'));

    // User1 transfer 10 crCLP tokens to user2.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).transfer(user2Address, toWei('10'));

    // User2 mints 10 CLP tokens and he will get 100 cake rewards.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).mint(toWei('10'));

    // User1 claims cake rewards.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).claimCake(user1Address);
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).claimCake(user2Address);

    const user1Balance = await cake.balanceOf(user1Address);
    const user2Balance = await cake.balanceOf(user2Address);
    expect(Number(user1Balance.mul(3))).to.closeTo(Number(user2Balance), 10 ** 10);
  })

  it('borrows some and repay', async () => {
    /*
     * rewards: 34 cake / blk (the rewards of pool 0 will be adjusted by adding new pool)
     *
     * blk  0          1          2          3          4
     *      |----------|----------|----------|----------|
     *                 |          |          |          |
     * user1       supply(10)     |          |       claim()
     *                      (34)  |   (34)   |   (34)
     * cake           +0          |          |        +102
     *                            |          |
     * user2                   borrow(5)  repay(5)
     *                                 (0)
     * cake                     +0         +0
     */
    expect(await cake.balanceOf(user1Address)).to.equal(0);
    expect(await cake.balanceOf(user2Address)).to.equal(0);

    await clp.connect(user1).approve(crCLP.address, MAX);
    await clp.connect(user2).approve(crCLP.address, MAX);

    // User2 mints 1000 crBNB tokens and enters market.
    await crBNB.connect(user2).mint({value: toWei('1000')});
    await unitroller.connect(user2).enterMarkets([crBNBAddress]);

    // User1 mints 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).mint(toWei('10'));

    // User2 borrows 5 CLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).borrow(toWei('5'));
    expect(await cake.balanceOf(user2Address)).to.equal(0);
    expect(await clp.balanceOf(user2Address)).to.equal(toWei('105'));
    expect(await clp.balanceOf(masterChefAddress)).to.equal(toWei('5'));
    expect(await clp.balanceOf(crCLP.address)).to.equal(0);

    // User2 repays 5 CLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).repayBorrow(MAX);
    expect(await cake.balanceOf(user2Address)).to.equal(0);
    expect(await clp.balanceOf(user2Address)).to.lt(toWei('100'));
    expect(await clp.balanceOf(masterChefAddress)).to.gt(toWei('10'));
    expect(await clp.balanceOf(crCLP.address)).to.equal(0);

    // User1 claims cake rewards.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).claimCake(user1Address);

    expect(await cake.balanceOf(user1Address)).to.gt(toWei('102'));
  })

  it('borrows all and repay', async () => {
    /*
     * rewards: 34 cake / blk (the rewards of pool 0 will be adjusted by adding new pool)
     *
     * blk  0          1          2          3          4
     *      |----------|----------|----------|----------|
     *                 |          |          |          |
     * user1       supply(10)     |          |       claim()
     *                     (34)   |    (0)   |   (34)
     * cake           +0          |          |        +68
     *                            |          |
     * user2                   borrow(10) repay(10)
     *                                 (0)
     * cake                     +0         +0
     */
    expect(await cake.balanceOf(user1Address)).to.equal(0);
    expect(await cake.balanceOf(user2Address)).to.equal(0);

    await clp.connect(user1).approve(crCLP.address, MAX);
    await clp.connect(user2).approve(crCLP.address, MAX);

    // User2 mints 1000 crBNB tokens and enters market.
    await crBNB.connect(user2).mint({value: toWei('1000')});
    await unitroller.connect(user2).enterMarkets([crBNBAddress]);

    // User1 mints 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).mint(toWei('10'));

    // User2 borrows 10 CLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).borrow(toWei('10'));
    expect(await cake.balanceOf(user2Address)).to.equal(0);
    expect(await clp.balanceOf(user2Address)).to.equal(toWei('110'));
    expect(await clp.balanceOf(masterChefAddress)).to.equal(0);
    expect(await clp.balanceOf(crCLP.address)).to.equal(0);

    // User2 repays 10 CLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).repayBorrow(MAX);
    expect(await cake.balanceOf(user2Address)).to.equal(0);
    expect(await clp.balanceOf(user2Address)).to.lt(toWei('100'));
    expect(await clp.balanceOf(masterChefAddress)).to.gt(toWei('10'));
    expect(await clp.balanceOf(crCLP.address)).to.equal(0);

    // User1 claims cake rewards.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).claimCake(user1Address);
    expect(await cake.balanceOf(user1Address)).to.gt(toWei('68'));
    expect(await cake.balanceOf(user1Address)).to.lt(toWei('102'));
  })

  it('adds reserves and reduce reserves', async () => {
    /*
     * rewards: 34 cake / blk (the rewards of pool 0 will be adjusted by adding new pool)
     *
     * blk  0          1          2          3          4          5          6          7          8
     *      |----------|----------|----------|----------|----------|----------|----------|----------|
     *                 |          |          |          |          |          |          |          |
     * user1       supply(10)     |          |          |      redeem(10)     |       claim()       |
     *                     (34)   |   (17)   |   (17)   |   (17)              |                     |
     * cake           +0          |          |          |         +0          |        +85          |
     *                            |          |          |                     |                     |
     * user2                   supply(10)    |          |                 redeem(10)             claim()
     *                                (17)   |   (17)   |   (17)       (34)
     * cake                      +0          |          |                    +0                   +85
     *                                       |          |
     * admin                              addR(20)  reduceR(20)
     */
    expect(await cake.balanceOf(user1Address)).to.equal(0);
    expect(await cake.balanceOf(user2Address)).to.equal(0);
    expect(await cake.balanceOf(adminAddress)).to.equal(0);

    await clp.connect(user1).approve(crCLP.address, MAX);
    await clp.connect(user2).approve(crCLP.address, MAX);
    await clp.connect(admin).approve(crCLP.address, MAX);

    // User1 mints 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).mint(toWei('10'));
    expect(await clp.balanceOf(masterChefAddress)).to.equal(toWei('10'));
    expect(await cake.balanceOf(user1Address)).to.equal(0);

    // User2 mints 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).mint(toWei('10'));
    expect(await clp.balanceOf(masterChefAddress)).to.equal(toWei('20'));
    expect(await cake.balanceOf(user2Address)).to.equal(0);

    // Admin adds reserves.
    await provider.send("evm_mine", []);
    await crCLP.connect(admin)._addReserves(toWei('20'));
    expect(await clp.balanceOf(masterChefAddress)).to.equal(toWei('40'));
    expect(await cake.balanceOf(adminAddress)).to.equal(0);

    // Admin reduces reserves.
    await provider.send("evm_mine", []);
    await crCLP.connect(admin)._reduceReserves(toWei('20'));
    expect(await clp.balanceOf(masterChefAddress)).to.equal(toWei('20'));
    expect(await cake.balanceOf(adminAddress)).to.equal(0);

    // User1 redeems 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user1).redeemUnderlying(toWei('10'));
    expect(await clp.balanceOf(masterChefAddress)).to.equal(toWei('10'));
    expect(await cake.balanceOf(user1Address)).to.equal(0);

    // User2 redeems 10 crCLP tokens.
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).redeemUnderlying(toWei('10'));
    expect(await clp.balanceOf(masterChefAddress)).to.equal(0);
    expect(await cake.balanceOf(user2Address)).to.equal(0);

    await provider.send("evm_mine", []);
    await crCLP.connect(user1).claimCake(user1Address);
    await provider.send("evm_mine", []);
    await crCLP.connect(user2).claimCake(user2Address);

    const user1Balance = await cake.balanceOf(user1Address);
    const user2Balance = await cake.balanceOf(user2Address);
    expect(user1Balance).to.equal(user2Balance);
  })
});
