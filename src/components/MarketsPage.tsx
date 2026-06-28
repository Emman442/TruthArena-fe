import React, { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Wallet, Percent, Shield, ArrowUpRight, CheckCircle, Gift, RefreshCw } from "lucide-react";
import { Claim, MarketStake } from "../types";

interface MarketsPageProps {
  claims: Claim[];
  isConnected: boolean;
  walletAddress: string;
  onConnectClick: () => void;
  onNavigate: (path: string) => void;
  fetchClaims: () => void;
  addToast: (msg: string, type: "success" | "error") => void;
}

export default function MarketsPage({
  claims,
  isConnected,
  walletAddress,
  onConnectClick,
  onNavigate,
  fetchClaims,
  addToast
}: MarketsPageProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  
  // Staking form state
  const [stakeAmount, setStakeAmount] = useState("");
  const [stakePrediction, setStakePrediction] = useState<'Support' | 'Challenge'>('Support');
  const [isStaking, setIsStaking] = useState(false);
  const [isClaimingPayout, setIsClaimingPayout] = useState(false);

  // Fetch user profile to get fresh balance
  const fetchProfile = () => {
    if (isConnected && walletAddress) {
      fetch(`/api/profile/${walletAddress}`)
        .then((res) => res.json())
        .then((data) => setUserProfile(data))
        .catch((e) => console.error("Error fetching profile inside markets", e));
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [isConnected, walletAddress]);

  const handlePlaceStake = async (e: React.FormEvent, claimId: string) => {
    e.preventDefault();
    const amount = parseInt(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast("Please enter a valid positive GEN amount to stake.", "error");
      return;
    }

    if (!isConnected) {
      onConnectClick();
      return;
    }

    if (userProfile && userProfile.genBalance < amount) {
      addToast("Insufficient GEN token balance in your wallet.", "error");
      return;
    }

    setIsStaking(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/stake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          prediction: stakePrediction,
          userAddress: walletAddress
        })
      });

      if (res.ok) {
        addToast(`Successfully staked ${amount} GEN on ${stakePrediction}!`, "success");
        setStakeAmount("");
        fetchClaims();
        fetchProfile();
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to place stake", "error");
      }
    } catch (err) {
      addToast("Staking failed. Network transmission or blockchain error.", "error");
    } finally {
      setIsStaking(false);
    }
  };

  const handleClaimPayout = async (claimId: string) => {
    if (!isConnected) {
      onConnectClick();
      return;
    }

    setIsClaimingPayout(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/claim-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: walletAddress })
      });

      if (res.ok) {
        const data = await res.json();
        addToast(`Payout claimed successfully! You received ${data.payout} GEN!`, "success");
        fetchClaims();
        fetchProfile();
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to claim payout", "error");
      }
    } catch (err) {
      addToast("Network or blockchain transmission error.", "error");
    } finally {
      setIsClaimingPayout(false);
    }
  };

  const selectedClaim = claims.find((c) => c.id === selectedClaimId);

  // Separate active and resolved markets
  const activeMarkets = claims.filter(c => c.status === "Pending" || c.status === "Investigating");
  const resolvedMarkets = claims.filter(c => c.status !== "Pending" && c.status !== "Investigating");

  // Calculate market stats helper
  const getMarketStats = (claim: Claim) => {
    const sPool = claim.supportPool || 0;
    const cPool = claim.challengePool || 0;
    const total = sPool + cPool;
    const sPct = total === 0 ? 50 : Math.round((sPool / total) * 100);
    const cPct = total === 0 ? 50 : 100 - sPct;

    // Get user stakes in this market
    const userStakes = claim.marketStakes?.filter(
      s => s.userAddress.toLowerCase() === walletAddress.toLowerCase()
    ) || [];

    // Check if user has unclaimed winning stakes
    const winningPrediction = claim.status === "Verified" ? "Support" : "Challenge";
    const winningStakes = userStakes.filter(s => s.prediction === winningPrediction && !s.claimed);
    const totalWinningStaked = winningStakes.reduce((sum, s) => sum + s.amount, 0);

    // Estimate payout
    const winPoolSize = winningPrediction === "Support" ? sPool : cPool;
    const losePoolSize = winningPrediction === "Support" ? cPool : sPool;
    const estimatedPayout = Math.floor(totalWinningStaked + (totalWinningStaked / (winPoolSize || 1) * losePoolSize));

    return {
      sPool,
      cPool,
      total,
      sPct,
      cPct,
      userStakes,
      hasWinningStakes: winningStakes.length > 0,
      estimatedPayout
    };
  };

  return (
    <div id="markets-page-container" className="py-8 sm:py-12 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto space-y-12">
      
      {/* Page Header */}
      <div id="markets-header" className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-[#e5e5e5]">
        <div className="space-y-2">
          <h2 id="markets-title" className="text-3xl font-extrabold tracking-tight text-[#0a0a0a]">
            Truth Markets
          </h2>
          <p id="markets-subtitle" className="text-sm text-[#6b7280]">
            Stake your GEN tokens on whether you believe claims will resolve as verified or false. Win payouts based on collective consensus accuracy.
          </p>
        </div>

        {/* User Balance Box */}
        <div className="flex-shrink-0">
          {isConnected ? (
            <div className="border border-black bg-white px-5 py-3 font-mono text-xs flex flex-col gap-1">
              <span className="text-[#6b7280] uppercase tracking-wider text-[10px]">Your Wallet Balance</span>
              <span className="text-sm font-bold text-[#0a0a0a]">
                {userProfile?.genBalance?.toLocaleString() || "0"} GEN
              </span>
            </div>
          ) : (
            <button
              id="markets-connect-btn"
              onClick={onConnectClick}
              className="px-5 py-3 border border-black font-mono text-xs font-bold hover:bg-[#f3f3f3]"
            >
              Connect Wallet to Participate
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: List of Market Pools */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Active Markets Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#0a0a0a] flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Active Truth Markets
            </h3>

            <div id="active-markets-list" className="space-y-4">
              {activeMarkets.length > 0 ? (
                activeMarkets.map((claim) => {
                  const isActive = claim.id === selectedClaimId;
                  const stats = getMarketStats(claim);

                  return (
                    <button
                      key={claim.id}
                      id={`market-card-${claim.id}`}
                      onClick={() => setSelectedClaimId(claim.id)}
                      className={`w-full text-left p-5 border transition-all ${
                        isActive 
                          ? "border-black bg-[#fdfdfd] ring-1 ring-black shadow-xs" 
                          : "border-[#e5e5e5] bg-white hover:border-black"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <span className="text-[10px] bg-[#f3f3f3] text-[#6b7280] px-2 py-0.5 font-mono font-bold uppercase">
                          {claim.category}
                        </span>
                        <span className="font-mono text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-50 px-1.5 py-0.5">
                          {claim.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[#0a0a0a] line-clamp-2 mb-4">
                        {claim.title}
                      </h4>

                      {/* Staking Odds visual split */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-[#6b7280]">
                          <span>{stats.sPct}% Support</span>
                          <span>{stats.cPct}% Challenge</span>
                        </div>
                        <div className="w-full h-1.5 flex bg-[#e5e5e5]">
                          <div className="h-full bg-black" style={{ width: `${stats.sPct}%` }} />
                          <div className="h-full bg-[#9ca3af]" style={{ width: `${stats.cPct}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#f3f3f3] mt-3 text-[10px] font-mono text-[#6b7280]">
                        <span>Total Staked:</span>
                        <span className="font-bold text-[#0a0a0a]">
                          {stats.total.toLocaleString()} GEN
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs font-mono text-[#6b7280] italic">No active markets available.</p>
              )}
            </div>
          </div>

          {/* Resolved Markets Section */}
          <div className="space-y-4 pt-4 border-t border-[#e5e5e5]">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#6b7280]">
              Resolved Markets
            </h3>

            <div id="resolved-markets-list" className="space-y-4">
              {resolvedMarkets.length > 0 ? (
                resolvedMarkets.map((claim) => {
                  const isActive = claim.id === selectedClaimId;
                  const stats = getMarketStats(claim);
                  const winner = claim.status === "Verified" ? "Support" : "Challenge";

                  return (
                    <button
                      key={claim.id}
                      id={`market-card-resolved-${claim.id}`}
                      onClick={() => setSelectedClaimId(claim.id)}
                      className={`w-full text-left p-4 border transition-all ${
                        isActive 
                          ? "border-black bg-[#fdfdfd] ring-1 ring-black shadow-xs" 
                          : "border-[#e5e5e5] bg-white hover:border-black"
                      }`}
                    >
                      <h4 className="text-xs font-bold text-[#0a0a0a] line-clamp-2 mb-3">
                        {claim.title}
                      </h4>

                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-[#6b7280]">Winner:</span>
                        <span className="font-bold text-green-600 uppercase">
                          {winner} ({claim.status})
                        </span>
                      </div>

                      {stats.hasWinningStakes && (
                        <div className="mt-2 bg-[#16a34a]/10 border border-[#16a34a] px-2.5 py-1 text-[10px] font-mono font-bold text-[#16a34a] text-center uppercase tracking-wide animate-pulse">
                          Payout Awaiting Claim!
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="text-xs font-mono text-[#6b7280] italic">No resolved markets yet.</p>
              )}
            </div>
          </div>

        </div>

        {/* Right columns: Selected Market Dashboard & Interaction panel */}
        <div className="lg:col-span-2">
          {selectedClaim ? (
            (() => {
              const stats = getMarketStats(selectedClaim);
              const isMarketActive = selectedClaim.status === "Pending" || selectedClaim.status === "Investigating";
              const resolvedWinner = selectedClaim.status === "Verified" ? "Support" : "Challenge";

              return (
                <div id="selected-market-panel" className="border border-black bg-white p-6 sm:p-8 space-y-8">
                  
                  {/* Claim Details block */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#6b7280]">
                        MARKET ID: {selectedClaim.id}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                        isMarketActive ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                      }`}>
                        {isMarketActive ? "Active Betting" : "Market Resolved"}
                      </span>
                    </div>

                    <h3 className="text-xl font-extrabold text-[#0a0a0a] leading-tight">
                      {selectedClaim.title}
                    </h3>

                    <p className="text-sm text-[#6b7280] leading-relaxed">
                      {selectedClaim.text}
                    </p>
                  </div>

                  {/* Pool Ratio Board */}
                  <div className="border border-[#e5e5e5] bg-[#fafafa] p-6 space-y-6">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#6b7280]">
                      On-Chain Staking Ratios
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-r border-[#e5e5e5] pr-4">
                        <span className="text-[10px] font-mono text-[#6b7280] block">SUPPORT POOL (TRUE)</span>
                        <span className="text-lg font-bold text-black font-mono">
                          {stats.sPool.toLocaleString()} GEN
                        </span>
                        <span className="text-xs font-mono text-[#6b7280] block mt-1">
                          Odds multiplier: {(stats.cPct === 0 ? 1 : 1 + (stats.cPct / (stats.sPct || 1))).toFixed(2)}x
                        </span>
                      </div>

                      <div className="pl-4">
                        <span className="text-[10px] font-mono text-[#6b7280] block">CHALLENGE POOL (FALSE)</span>
                        <span className="text-lg font-bold text-black font-mono">
                          {stats.cPool.toLocaleString()} GEN
                        </span>
                        <span className="text-xs font-mono text-[#6b7280] block mt-1">
                          Odds multiplier: {(stats.sPct === 0 ? 1 : 1 + (stats.sPct / (stats.cPct || 1))).toFixed(2)}x
                        </span>
                      </div>
                    </div>

                    {/* Styled ratio bar */}
                    <div className="space-y-1.5 pt-2">
                      <div className="w-full h-4 flex bg-[#e5e5e5]">
                        <div className="h-full bg-black text-[10px] font-mono font-bold text-white flex items-center justify-center" style={{ width: `${stats.sPct}%` }}>
                          {stats.sPct >= 15 && `${stats.sPct}%`}
                        </div>
                        <div className="h-full bg-[#9ca3af] text-[10px] font-mono font-bold text-white flex items-center justify-center" style={{ width: `${stats.cPct}%` }}>
                          {stats.cPct >= 15 && `${stats.cPct}%`}
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[#9ca3af]">
                        <span>Verified outcome</span>
                        <span>False/Misleading/Unverified outcome</span>
                      </div>
                    </div>
                  </div>

                  {/* User Stakes overview */}
                  <div className="border-t border-[#e5e5e5] pt-6 space-y-4">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#6b7280]">
                      Your Staking Positions
                    </h4>

                    {stats.userStakes.length > 0 ? (
                      <div className="space-y-2 font-mono text-xs">
                        {stats.userStakes.map((stake) => (
                          <div key={stake.id} className="flex justify-between items-center bg-[#fafafa] border border-[#e5e5e5] px-4 py-3">
                            <span className="flex items-center gap-1.5 font-bold">
                              <Shield className="w-3.5 h-3.5" />
                              Staked on {stake.prediction}
                            </span>
                            <div className="flex items-center gap-4">
                              <span>{stake.amount.toLocaleString()} GEN</span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 ${
                                stake.claimed 
                                  ? "bg-gray-100 text-gray-500" 
                                  : isMarketActive 
                                    ? "bg-amber-100 text-amber-800"
                                    : stake.prediction === resolvedWinner
                                      ? "bg-green-100 text-green-800 animate-pulse"
                                      : "bg-red-100 text-red-800"
                              }`}>
                                {stake.claimed ? "Claimed" : isMarketActive ? "Active" : stake.prediction === resolvedWinner ? "Won (Unclaimed)" : "Lost"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-mono text-[#6b7280] italic">
                        You have no staking positions in this market yet.
                      </p>
                    )}
                  </div>

                  {/* Active Market interaction builder */}
                  {isMarketActive ? (
                    <div className="border-t border-[#e5e5e5] pt-6 space-y-4">
                      <h4 className="text-sm font-bold text-[#0a0a0a]">
                        Place New Prediction Stake
                      </h4>

                      <form onSubmit={(e) => handlePlaceStake(e, selectedClaim.id)} className="space-y-4">
                        {/* Selector toggle */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setStakePrediction('Support')}
                            className={`py-3 px-4 border text-xs font-mono font-bold text-center transition-colors ${
                              stakePrediction === 'Support'
                                ? "border-black bg-black text-white"
                                : "border-[#e5e5e5] text-black hover:border-black bg-white"
                            }`}
                          >
                            SUPPORT VERIFIED OUTCOME
                          </button>
                          <button
                            type="button"
                            onClick={() => setStakePrediction('Challenge')}
                            className={`py-3 px-4 border text-xs font-mono font-bold text-center transition-colors ${
                              stakePrediction === 'Challenge'
                                ? "border-black bg-black text-white"
                                : "border-[#e5e5e5] text-black hover:border-black bg-white"
                            }`}
                          >
                            CHALLENGE OUTCOME (FALSE/MISLEADING)
                          </button>
                        </div>

                        {/* Amount Box */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono text-[#6b7280] block uppercase tracking-wider">
                            Stake Amount (GEN)
                          </label>
                          <div className="flex gap-2 max-w-sm">
                            <input
                              id="stake-amount-input"
                              type="number"
                              required
                              min="10"
                              placeholder="Min 10 GEN"
                              value={stakeAmount}
                              onChange={(e) => setStakeAmount(e.target.value)}
                              className="flex-grow px-3 py-2 border border-black text-xs text-[#0a0a0a] focus:outline-none font-mono"
                            />
                            {isConnected ? (
                              <button
                                id="submit-stake-btn"
                                type="submit"
                                disabled={isStaking}
                                className="px-6 py-2 bg-[#0a0a0a] text-white text-xs font-mono font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isStaking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                                Place Stake
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={onConnectClick}
                                className="px-4 py-2 border border-black font-mono text-xs font-bold text-black hover:bg-[#f3f3f3]"
                              >
                                Connect Wallet
                              </button>
                            )}
                          </div>
                        </div>
                      </form>
                    </div>
                  ) : (
                    /* Resolved Market Claim panel */
                    <div className="border-t border-[#e5e5e5] pt-6 space-y-4">
                      <div className="border border-green-500 bg-green-50/50 p-6 text-center space-y-4">
                        <div className="inline-flex items-center gap-2 text-[#16a34a] font-mono font-bold text-sm">
                          <CheckCircle className="w-5 h-5" />
                          Consensus Verdict Resolved: {selectedClaim.status.toUpperCase()}
                        </div>
                        <p className="text-xs text-[#6b7280] max-w-md mx-auto leading-relaxed">
                          The on-chain contract successfully audited research materials and closed the book on this claim. Stakers who successfully predicted <b>{resolvedWinner}</b> are eligible to claim payout shares proportionally.
                        </p>

                        {stats.hasWinningStakes ? (
                          <div className="space-y-3 pt-2">
                            <div className="text-xs font-mono text-[#16a34a]">
                              Estimated claimable reward: <span className="font-bold text-sm">{stats.estimatedPayout.toLocaleString()} GEN</span>
                            </div>
                            <button
                              id="claim-payout-btn"
                              onClick={() => handleClaimPayout(selectedClaim.id)}
                              disabled={isClaimingPayout}
                              className="px-6 py-3 bg-[#16a34a] text-white font-mono text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mx-auto"
                            >
                              {isClaimingPayout ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Claiming Payout on-chain...
                                </>
                              ) : (
                                <>
                                  <Gift className="w-4 h-4" />
                                  Claim {stats.estimatedPayout.toLocaleString()} GEN Payout
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs font-mono text-[#6b7280] pt-2">
                            No unclaimed winning shares found under this connected wallet account address.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()
          ) : (
            <div className="border border-[#e5e5e5] bg-[#fafafa] py-32 text-center flex flex-col items-center justify-center space-y-4 px-6 h-full">
              <TrendingUp className="w-12 h-12 text-[#9ca3af]" />
              <div className="space-y-1">
                <p className="text-sm font-mono font-bold text-[#0a0a0a]">No Prediction Market Selected</p>
                <p className="text-xs text-[#6b7280] max-w-sm">
                  Select an active or resolved truth market from the list on the left to view pool volumes, current ratios, or stake your tokens.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
