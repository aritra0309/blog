---
title: "Akuna 2026 Quant Challenge: Pricing a Yes/No Market"
date: 2026-08-25
category: competition
tags: [quantitative-finance, market-making, probability, python, options]
excerpt: "I built four binary-option market makers for the Akuna 2026 Quant Challenge. The best one made $139 and outperformed all four comparison bots by treating a yes/no payoff as a probability, then treating inventory as a problem worth pricing too."
slug: akuna-2026-quant-challenge
---

Most trading ideas sound much simpler before there is inventory involved.

For the Akuna 2026 Quant Challenge, the contracts were binary options: each one eventually pays either one dollar or nothing. At first that felt like a friendly starting point. There is no volatility surface to calibrate, no complicated payoff diagram, and every price lives neatly between zero and one.

Then the actual problem showed up. You are not only trying to predict whether a contract should pay out. You are a market maker. You have to quote both a bid and an offer, decide how much risk to show, accept or reject fill-or-kill orders, keep enough cash to survive being wrong, and stop your own inventory from quietly becoming one huge bet.

I built four Python market makers around that problem: an aggressive strategy, a hybrid strategy, a passive strategy, and a conservative hybrid. The top model made **$139 profit** in the competition simulation and outperformed all **four Akuna comparison bots**.

Repository: [github.com/aritra0309/akuna-quant-2026](https://github.com/aritra0309/akuna-quant-2026)

## The contract is a probability wearing an option label

Each contract was defined by a weighted combination of underlyings—two company-like prices, AJR and THR, plus a Fed-funds-rate process—and a strike $K$.

At expiry, the observable is

$$
Y_T = \sum_{j=1}^{m} w_jX_{j,T}.
$$

The payoff is as direct as it gets:

$$
V_T =
\begin{cases}
1, & Y_T \ge K,\\
0, & Y_T < K.
\end{cases}
$$

So the fair value, in this simplified game without discounting, is just the probability that the condition is true:

$$
F_0 = \mathbb{E}[V_T] = \Pr(Y_T \ge K).
$$

That equation became the centre of the project. If I could estimate $F_0$ reasonably, then quoting was not about inventing a price. It was about deciding how far away from that price I wanted to trade.

## I did not want a single-point forecast for rates

The rate process moves on a discrete grid in 25-basis-point steps. A lazy version of the model would predict one terminal rate and price everything conditional on that one outcome. That is attractive because it is easy. It is also exactly the kind of simplification that turns uncertainty into false confidence.

Instead, I propagated the full rate distribution forward. At every rate state $r$, the probability of an upward, downward, or unchanged move is tilted toward a target rate $r^*$:

$$
\tau(r)=\kappa(r^*-r),
$$

$$
p_{\uparrow}(r)=\mathrm{clip}(p_{\uparrow}+\tau(r),0,1),
$$

$$
p_{\downarrow}(r)=\mathrm{clip}(p_{\downarrow}-\tau(r),0,1-p_{\uparrow}(r)),
\qquad
p_0(r)=1-p_{\uparrow}(r)-p_{\downarrow}(r).
$$

The model walks that distribution forward one step at a time. By expiry, it has a probability mass function over every reachable rate state rather than one heroic forecast.

That means the final option price is a mixture:

$$
F_0 = \sum_r \Pr(R_T=r)q(r),
$$

where $q(r)$ is the probability that the contract settles at one, conditional on terminal rate $r$.

This was one of my favourite parts of the build. The rate space is small enough to enumerate exactly, so there was no reason to approximate away something the machine could just calculate.

## What the company-price model was doing

From historical observations, I converted company prices into log returns and regressed them on changes in the rate:

$$
r_{i,t}=\log(X_{i,t}/X_{i,t-1})
=\alpha_i+\beta_{i,R}\Delta R_t+\varepsilon_{i,t}.
$$

The fitted slope used regularized covariance-over-variance regression:

$$
\beta_{i,R}=
\frac{\mathrm{Cov}(\Delta R,r_i)}
{\mathrm{Var}(\Delta R)(1+\lambda)}.
$$

The ridge term $\lambda$ matters here less because it is fashionable and more because a small history can make a noisy rate beta look much more certain than it really is.

I also split the residual movement into a shared sector factor and company-specific noise. Conditional on a terminal rate, that gives each company a lognormal terminal distribution:

$$
\log X_{i,T}\mid R_T=r \sim \mathcal{N}(\mu_i,v_i),
$$

$$
\mu_i=\log X_{i,0}+T\alpha_i+\beta_{i,R}(r-R_0),
\qquad
v_i=T\left(\beta_{i,S}^2\sigma_S^2+\sigma_{i,\mathrm{idio}}^2\right).
$$

For a one-company threshold contract, the conditional price falls out of the normal CDF:

$$
q(r)=\Phi\left(
\frac{\mu_i-\log(K'/w_i)}{\sqrt{v_i}}
\right),
$$

with $K'$ representing the strike after moving the rate leg to the other side.

For relative-value contracts, such as one company versus another, I could use the distribution of the log-price ratio. For general two-leg combinations, I used a moment-matched normal approximation for the weighted sum. It was a deliberately practical split: use the cleaner formula when the payoff structure allows it, and use a controlled approximation when it does not.

## Fair value is not the same thing as a quote

If the model says a contract is worth 0.54, quoting 0.54 on both sides is an excellent way to collect adverse selection and very little else.

The quote needs a spread, and the spread needs to know two things: how uncertain the event is, and how uncomfortable the existing inventory has become.

I calculated a reservation price $R$ and half-spread $H$, then rounded outward to whole cents:

$$
\mathrm{bid}=\lfloor100(R-H)\rfloor/100,
\qquad
\mathrm{offer}=\lceil100(R+H)\rceil/100.
$$

The risk-aware models move the reservation price away from existing inventory. If I am already long a contract, I become less eager to buy more and more eager to sell it; if I am short, the logic reverses. In compact form:

$$
R=\mathrm{clip}\left(
F_0-0.05\,\mathrm{sign}(n)\,u\,
\max(0.35,4F_0(1-F_0)),
0.005,0.995
\right).
$$

Here $n$ is the current position and $u$ is its risk utilization. The $4F_0(1-F_0)$ term is largest near 50%, which is exactly where a binary event is most uncertain. The same idea widens the spread when uncertainty, time, or inventory use is high.

That is the difference between a model that predicts a probability and a model that can make a market. The former says, “I think this is 54%.” The latter says, “I think this is 54%, I already own too much of it, and I need you to pay me more if you want me to take even more.”

## Size was a first-class decision

I did not assume the best strategy was simply the one that traded most. That is why the repository has four variants.

- The **aggressive** model can quote up to 100 contracts and uses a 35% per-trade cash fraction, while retaining a 20% reserve.
- The **hybrid** model still quotes up to 100 but lowers deployment to 25%, raises the reserve to 25%, and reduces its per-underlying exposure limit.
- The **passive** model quotes at most 10 contracts and requires a clear edge before accepting a fill-or-kill order.
- The **conservative hybrid** also starts with 10-lot quotes, then cuts to two contracts close to expiry when the reservation price is between 0.35 and 0.65—the awkward zone where the outcome is still genuinely uncertain.

The aggressive and hybrid versions go beyond a raw position count. A long binary contract can lose its purchase price; a short contract can lose $1 minus its sale price. The engine records that collateral, budgets risk per contract, caps exposure per underlying, and releases collateral after settlement.

## The best trade is sometimes the one I declined

The competition also includes fill-or-kill orders. These are not invitations to trade just because the other side clicked a button.

For every proposed fill, the model checks the projected inventory, capital required, and the difference between execution price and reservation price. It then evaluates return on maximum loss:

$$
\mathrm{return\ on\ risk} =
\frac{\mathrm{edge}}
{\max(\mathrm{loss\ per\ contract},0.01)}.
$$

Inventory-increasing fills need at least a one-cent edge and 15% return on risk. A fill that reduces existing inventory is allowed at a lower bar: half a cent and 5%. That was intentional. Flattening a risky position is valuable even if its standalone edge is smaller.

This is also where the project stopped feeling like a probability exercise and started feeling more like actual risk management. You can be correct about a contract and still take a terrible trade because you took it too large, too late, or on top of an already concentrated position.

## What I would improve next

The result was encouraging, but I would not call the work finished because it made a profit once. The next version would focus on testing the assumptions, not just decorating the strategy.

- **Run many seeded simulations** and report a distribution of P&L, drawdown, fill rate, and inventory turnover instead of one headline result.
- **Stress the calibration window** to see how rate-beta and covariance estimates behave when the historical sample is short or regime-shifted.
- **Compare exact and simulated pricing** for the multi-leg approximation, particularly around strikes where the payout probability changes sharply.
- **Add an explicit adverse-selection model** so spreads respond not just to the model's uncertainty but also to which counterparty behaviour tends to be informed.
- **Tune the inventory parameters systematically** using out-of-sample simulations rather than choosing every limit by hand.

The main lesson from the challenge was simple: a binary option is not a trivial instrument just because the answer is yes or no. The payoff is binary. The pricing, quoting, sizing, and inventory management absolutely are not.
