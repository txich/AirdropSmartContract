import { ethers } from "hardhat";
import { expect } from "chai";

describe("Airdrop (updated)", function () {
  let airdrop: any;
  let owner: any, user1: any, user2: any, outsider: any;

  beforeEach(async function () {
    [owner, user1, user2, outsider] = await ethers.getSigners();
    const AirdropFactory = await ethers.getContractFactory("Airdrop", owner);
    airdrop = await AirdropFactory.deploy();
    await airdrop.waitForDeployment();
  });

  describe("registration phase", () => {
    it("allows user with ≥1 ETH to register", async () => {
      let bal = await ethers.provider.getBalance(user1.address);
      if (bal < ethers.parseEther("1")) {
        await owner.sendTransaction({
          to: user1.address,
          value: ethers.parseEther("1"),
        });
      }
      await expect(airdrop.connect(user1).registerAddress()).to.not.be.reverted;
      expect(await airdrop.isEligible(user1.address)).to.be.true;
      const addrs = await airdrop.viewAddresses();
      expect(addrs).to.include(user1.address);
    });

    it("prevents duplicate registration", async () => {
      await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
      await airdrop.connect(user1).registerAddress();
      await expect(airdrop.connect(user1).registerAddress()).to.be.revertedWith("Already registered");
    });

    it("prevents registration after startAirdrop", async () => {
      await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
      await airdrop.connect(user1).registerAddress();
      await owner.sendTransaction({ to: user2.address, value: ethers.parseEther("1") });
      await airdrop.connect(user2).registerAddress();
      await airdrop.connect(owner).addFunds({ value: ethers.parseEther("2") });
      await airdrop.connect(owner).startAirdrop();
      await owner.sendTransaction({ to: outsider.address, value: ethers.parseEther("1") });
      await expect(airdrop.connect(outsider).registerAddress()).to.be.revertedWith("Airdrop already started");
    });
  });

  describe("funding & start", () => {
    it("only owner can add funds", async () => {
      await expect(airdrop.connect(user1).addFunds({ value: ethers.parseEther("1") }))
        .to.be.revertedWith("Owner-only function");
      await expect(airdrop.connect(owner).addFunds({ value: ethers.parseEther("1") }))
        .to.not.be.reverted;
    });

    it("startAirdrop reverts without participants", async () => {
      await expect(airdrop.connect(owner).startAirdrop())
        .to.be.revertedWith("No eligible addresses");
    });

    it("startAirdrop computes allocation correctly", async () => {
      await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
      await airdrop.connect(user1).registerAddress();
      await owner.sendTransaction({ to: user2.address, value: ethers.parseEther("1") });
      await airdrop.connect(user2).registerAddress();
      await airdrop.connect(owner).addFunds({ value: ethers.parseEther("3") });
      await expect(airdrop.connect(owner).startAirdrop()).to.not.be.reverted;

      expect(await airdrop.airdropStarted()).to.equal(true);
      expect(await airdrop.allocation()).to.equal(ethers.parseEther("1.5"));
      expect(await airdrop.viewAllocation()).to.equal(ethers.parseEther("1.5"));
    });

    it("prevents non-owner from startAirdrop", async () => {
      await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
      await airdrop.connect(user1).registerAddress();
      await expect(airdrop.connect(user1).startAirdrop())
        .to.be.revertedWith("Owner-only function");
    });
  });

  describe("claim phase", () => {
    beforeEach(async () => {
      await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
      await airdrop.connect(user1).registerAddress();
      await owner.sendTransaction({ to: user2.address, value: ethers.parseEther("1") });
      await airdrop.connect(user2).registerAddress();
      await airdrop.connect(owner).addFunds({ value: ethers.parseEther("2") });
      await airdrop.connect(owner).startAirdrop();
    });

    it("allows eligible user to claim exactly allocation", async () => {
      const beforeBal = await ethers.provider.getBalance(user1.address);
      await expect(airdrop.connect(user1).claimAirdrop())
        .to.emit(airdrop, "AirdropClaimed")
        .withArgs(user1.address, ethers.parseEther("1"));
      const afterBal = await ethers.provider.getBalance(user1.address);
      const received = afterBal - beforeBal;
      expect(received).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
      expect(await airdrop.claimed(user1.address)).to.be.true;
    });

    it("prevents double claim", async () => {
      await airdrop.connect(user1).claimAirdrop();
      await expect(airdrop.connect(user1).claimAirdrop())
        .to.be.revertedWith("Already claimed");
    });

    it("prevents non-eligible from claiming", async () => {
      await expect(airdrop.connect(outsider).claimAirdrop())
        .to.be.revertedWith("You are not eligible");
    });

    it("allows second user to claim independently", async () => {
      await airdrop.connect(user2).claimAirdrop();
      expect(await airdrop.claimed(user2.address)).to.be.true;
    });

    it("leaves small remainder in contract if any", async () => {
      await airdrop.connect(user1).claimAirdrop();
      await airdrop.connect(user2).claimAirdrop();
      const rem = await ethers.provider.getBalance(airdrop.target);
      expect(rem).to.be.lt(ethers.parseEther("0.001"));
    });
  });

  describe("ownership", () => {
    it("owner can change ownership", async () => {
      await expect(airdrop.connect(owner).changeOwner(user1.address)).to.not.be.reverted;
      expect(await airdrop.owner()).to.equal(user1.address);
    });

    it("non-owner cannot change ownership", async () => {
      await expect(airdrop.connect(user2).changeOwner(user1.address))
        .to.be.revertedWith("Owner-only function");
    });
  });
});
