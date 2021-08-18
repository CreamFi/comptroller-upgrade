const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const unitrollerAbi = require('../abi/unitroller');
const comptrollerAbi = require("../abi/comptroller");
const erc20Abi = require("../abi/erc20");
const cCollateralCapDelegatorAbi = require("../abi/cCollateralCapDelegator");
const cTokenAdminAbi = require("../abi/cTokenAdmin");
crTokens = [
  "0x250Fb308199FE8C5220509C1bf83D21d60b7f74A", //crLON
  "0x2A867fd776B83e1bd4e13C6611AFd2F6af07EA6D", //crIBBTC
  "0x1241B10E7EA55b22f5b2d007e8fECDF73DCff999", //crPAXG
  "0xD7394428536F63d5659cc869EF69d10f9E66314B", //crPAX
  "0x766175eaC1A99C969dDd1EBDBe7e270D508d8FFF", //crEURT
  "0x81E346729723C4D15d0FB1c5679b9f2926Ff13C6", //crBNT
  "0xE585c76573D7593ABF21537B607091F76c996E73", //crWOO
  "0x8C3B7a4320ba70f8239F83770c4015B5bc4e6F91", //crFEI
  "0x98E329eB5aae2125af273102f3440DE19094b77c", //crSWAP
  "0x523EFFC8bFEfC2948211A05A905F761CBA5E8e9E", //crGNO
  "0x21011BC93d9E515B9511A817A1eD1D6d468f49Fc", //crCOVER
  "0x1A122348B73B58eA39F822A89e6ec67950c2bBD0", //crVVSP
  "0x71cEFCd324B732d4E058AfAcBA040d908c441847", //crVSP
  "0xDbb5e3081dEf4b6cdD8864aC2aeDA4cBf778feCf", //crMLN
  "0xdFFf11DFe6436e42a17B86e7F419Ac8292990393", //crARNXM
  "0xab10586C918612BA440482db77549d26B7ABF8f7", //crARMOR
  "0x28526Bb33d7230E65E735dB64296413731C5402e", //crSFI
  "0x081FE64df6dc6fc70043aedF3713a3ce6F190a21", //crRARI
  "0x7C3297cFB4c4bbd5f44b450c0872E0ADA5203112", //crOCEAN
  "0x299e254A8a165bBeB76D9D69305013329Eea3a3B", //crPERP
  "0xf8445C529D363cE114148662387eba5E62016e20", //crRAI
  "0x8379BAA817c5c5aB929b03ee8E3c48e45018Ae41", //crRUNE
  "0xc36080892c64821fa8e396bc1bD8678fA3b82b17", //crFTM
  "0x51F48b638F82e8765F7a26373A2Cb4CcB10C07af", //crUST
  "0x1d0986Fb43985c88Ffa9aD959CC24e6a087C7e35", //crALPHA
  "0xb092b4601850E23903A42EaCBc9D8A0EeC26A4d5", //crFRAX
  "0x2Db6c82CE72C8d7D770ba1b5F5Ed0b6E075066d6", //crAMP
  "0x59089279987DD76fC65Bf94Cb40E186b96e03cB3", //crOGN
  "0x65883978aDA0e707c3b2BE2A6825b1C4BDF76A90", //crAKRO
  "0xc68251421eDDa00a10815E273fA4b1191fAC651b", //crPICKLE
  "0x25555933a8246Ab67cbf907CE3d1949884E82B55", //crSUSD
  "0xC25EAE724f189Ba9030B2556a1533E7c8A732E14", //crSNX
  "0x197070723CE0D3810a0E47F06E935c30a480D4Fc", //crWBTC
  "0x7Aaa323D7e398be4128c7042d197a2545f0f1fea", //crOMG
  "0x85759961b116f1D36fD697855c57A6ae40793D9B", //cr1INCH
  "0x3C6C553A95910F9FC81c98784736bd628636D296", //crESD
  "0x10a3da2BB0Fae4D591476fd97D6636fd172923a8", //crHEGIC
  "0x92B767185fB3B04F881e3aC8e5B0662a027A1D9f", //crDAI
  "0xD692ac3245bb82319A31068D6B8412796eE85d2c", //crHUSD
  "0xfd609a03B393F1A1cFcAcEdaBf068CAD09a924E2", //crCRETH2
  "0xd5103AfcD0B3fA865997Ef2984C66742c51b2a8b", //crHFIL
  "0x054B7ed3F45714d3091e82aAd64A1588dC4096Ed", //crHBTC
  "0x903560b1CcE601794C584F58898dA8a8b789Fc5d", //crKP3R
  "0x3225E3C669B39C7c8B3e204a8614bB218c5e31BC", //crAAVE
  "0xf55BbE0255f7f4E70f63837Ff72A577fbDDbE924", //crBOND
  "0x7ea9C63E216D5565c3940A2B3d150e59C2907Db3", //crBBTC
  "0x2A537Fa9FFaea8C1A41D3C2B68a9cb791529366D", //crDPI
  "0x8b3FF1ed4F36C2c2be675AFb13CC3AA5d73685a5", //crCEL
  "0xeFF039C3c1D668f408d09dD7B63008622a77532C", //crWNXM
  "0xef58b2d5A1b8D3cDE67b8aB054dC5C831E9Bc025", //crSRM
  "0xe89a6D0509faF730BD707bf868d9A2A744a363C7", //crUNI
  "0x10FDBD1e48eE2fD9336a482D746138AE19e649Db", //crFTT
  "0x338286C0BC081891A4Bda39C7667ae150bf5D206", //crSUSHI
  "0x3623387773010d9214B10C551d6e7fc375D31F58", //crMTA
  "0x1FF8CDB51219a8838b52E9cAc09b71e591BC998e", //crBUSD
  "0x17107f40d70f4470d20CB3f138a052cAE8EbD4bE", //crRENBTC
  "0xc7Fd8Dcee4697ceef5a2fd4608a7BD6A94C77480", //crCRV
  "0x697256CAA3cCaFD62BB6d3Aa1C7C5671786A5fD9", //crLINK
  "0x19D1666f543D42ef17F66E376944A22aEa1a8E46", //crCOMP
  "0xcE4Fe9b4b8Ff61949DCfeB7e03bc9FAca59D2Eb3", //crBAL
  "0xCbaE0A83f4f9926997c8339545fb8eE32eDc6b76", //crYFI
  "0x44fbeBd2F576670a6C33f6Fc0B00aA8c5753b322", //crUSDC
  "0x797AAB1ce7c01eB727ab980762bA88e7133d2157", //crUSDT
]

describe('upgrade', () => {
  for (i=0; i<crTokens.length; i++){
    crTokens[i] = crTokens[i].toLowerCase()
  }

  const provider = waffle.provider;


  let accounts;
  let admin, adminAddress;

  let unitroller;
  let newComptroller;
  let flashloanLender;
  let flashloanReceiver;
  let bondWhale;
  let creamMultiSig;
  let cCollateralCapErc20DelegateFactory;

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const unitrollerAddress = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';
  const cTokenAdminAddress = '0x3FaE5e5722C51cdb5B0afD8c7082e8a6AF336Ee8';
  

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    const comptrollerFactory = await ethers.getContractFactory('Comptroller');
    newComptroller = await comptrollerFactory.deploy();

    const flashloanReceiverFactory = await ethers.getContractFactory('FlashloanReceiver');
    flashloanReceiver = await flashloanReceiverFactory.deploy() 

    const flashloanLenderFactory = await ethers.getContractFactory('FlashloanLender');
    flashloanLender = await flashloanLenderFactory.deploy(unitrollerAddress, creamMultisigAddress) 

    cCollateralCapErc20DelegateFactory = await ethers.getContractFactory('CCollateralCapErc20Delegate');

    unitroller = new ethers.Contract(unitrollerAddress, unitrollerAbi, provider);
    cTokenAdmin = new ethers.Contract(cTokenAdminAddress, cTokenAdminAbi, provider);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });
    // 1. upgrade comptroller
    await unitroller.connect(creamMultisig)._setPendingImplementation(newComptroller.address);
    await newComptroller.connect(creamMultisig)._become(unitroller.address);
    expect(await unitroller.comptrollerImplementation()).to.equal(newComptroller.address);
    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);
    

  });

  it('flash loan', async () => {
    allMarkets = await unitroller.getAllMarkets()
    var flashloanRevertMessage;
    for (i=0; i < allMarkets.length; i++){
      crTokenAddress = allMarkets[i].toLowerCase()
      if (crTokens.includes(crTokenAddress)){
        // need to upgrade to new ccollateralcap 
        newCrToken = await cCollateralCapErc20DelegateFactory.deploy()
        await cTokenAdmin.connect(creamMultisig)._setImplementation(crTokenAddress, newCrToken.address, true, "0x");
        await unitroller.connect(creamMultisig)._setFlashloanPaused(crTokenAddress, false);
        crToken = new ethers.Contract(crTokenAddress, cCollateralCapDelegatorAbi, provider);
        console.log('update')
        expect(await crToken.implementation()).to.equal(newCrToken.address);
        expect(await unitroller.flashloanGuardianPaused(crTokenAddress)).to.be.false
      } else {
        await unitroller.connect(creamMultisig)._setFlashloanPaused(crTokenAddress, true); 
        expect(await unitroller.flashloanGuardianPaused(crTokenAddress)).to.be.true
        console.log('no need to update')
      } 
    }
  });
});
