---
title: "Playground Series — s5e5 Predict Calorie Expenditure"
date: 2026-07-31
category: kaggle
tags: [kaggle, competition, regression, xgboost]
excerpt: "A window into my actual thought process while working through a Kaggle Playground Series competition, mistakes included."
slug: playground
---

I was told that practicing on Kaggle's Playground Series competitions is a solid way to build up the fundamental techniques people actually use in a data science career. This post is less "here's a polished solution" and more a window into my actual thought process while working through this one, mistakes included.

## Getting oriented

Like any dataset ought to start, the first move was just `train.info()` and `train.describe()` to get a feel for what I was working with: column types, ranges, missing values, the usual reconnaissance.

Two things stood out immediately. First, an ID column, useless for modeling, along with everything else. Second, a binary categorical column, Sex, which I encoded straightforwardly: 1 for male, 0 for female.

## Looking before leaping

Technically you can go build a model right after that. I didn't want to yet. I plotted a correlation map first, mostly out of curiosity, and found two patterns worth noting: a strong relationship between Duration, Heart_Rate, Body_Temp, and Calories, and a separate one between Height and Weight with respect to Gender.

![correlation heatmap](../images/correlation-heatmap.png)

At the time, I didn't know anything about feature engineering. Future me, having since learned better, knows it's generally ideal to have little to no correlation between your features, and would've done something about those two clusters instead of just admiring them in a heatmap.

## The part where it went badly

My first submission used a plain scikit-learn regression model with no tuning. It performed exactly as well as you'd expect, which is to say badly. I landed dead last in the competition. Not "near the bottom." Last.

That sent me looking for alternatives, which is how I learned about XGBoost (if you don't know what that is, I'll have a dedicated post on it soon, link incoming). Future me can now confirm that XGBoost, CatBoost, and LightGBM are basically the holy trinity of these competitions, usually shown up in some ensemble of the three.

My second attempt used XGBoost with fixed, hand-picked parameters. Better, but nothing to write home about, because I was essentially guessing at good hyperparameters.

## Nobody hand-tunes parameters at scale

Somewhere in there, a thought occurred to me: there are surely a huge number of companies hiring data scientists to build and maintain models, and there's no way all of them are manually testing every parameter combination by hand. A bit of research later, I found `sklearn.model_selection`, specifically `RandomizedSearchCV`.

Here's the parameter space I landed on for the final model, run across 50 iterations:

![hyperparameter search space](../images/hyperparameter-search.png)

## An annoying warning that taught me something

This got me the results I was after, but it came with a warning in the cell output: `Falling back to prediction using DMatrix due to mismatched devices`. Not an error, just a warning, but an annoying one all the same. Turns out it meant my model was training on GPU while the data it was working with was sitting on CPU.

Some digging (with help from the internet and Nvidia's own docs) introduced me to CuPy, which does array computations, the kind you'd normally do in NumPy, directly on an Nvidia GPU. That fixed it.


## Where the score landed

The competition's metric was RMSLE:

$$
\mathrm{RMSLE}
=
\sqrt{
\frac{1}{n}
\sum_{i=1}^{n}
\left(
\log(1+\hat{y}_i)
-
\log(1+y_i)
\right)^2
}

$$

My final score came out to **0.0579**. Not a leaderboard-topping number, but a real improvement over my very first attempt with plain linear regression, which scored **0.57**. An order of magnitude better, even if it's nowhere near where a tuned ensemble could take it.

## What future me would try next

A few open theories I haven't tested yet:

- **Actually doing feature engineering** this time, combining the highly correlated columns I spotted early on instead of just noting them and moving on.
- **Widening the hyperparameter search** further, since 50 iterations over that space was a reasonable start but not exhaustive.
- **Trying an ensemble** instead of a single XGBoost model, since that seems to be where the real gains live in these competitions.

If nothing else, this was a good reminder that the "obvious" first model is rarely the right one, and that most of the actual learning happens in the gap between "it technically ran" and "it ran well."
