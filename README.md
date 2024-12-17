# Reddit Clone API

A lightweight Reddit-style API built with Express.js and SQLite. This project implements core Reddit-like functionalities including subreddits, posts, comments, upvoting, and user subscriptions.

## Features

Subreddit Management

- Browse posts within subreddits
- Create new posts in subreddits
- Timeline view of subreddit posts

User System

- User profiles with subscription tracking
- Track total upvotes received
- View user's subscribed subreddits

Post Interaction

- Create and read posts
- Upvoting system (one upvote per user per post)
- Commenting system
- View all comments on a post

Subscription System

- Subscribe to subreddits
- View user subscriptions
- Prevent duplicate subscriptions

## Tech Stack

**Backend:** Express.js

**Server:** SQLite (in-memory)

## API Endpoints

Subreddit

- `GET /subreddits/:id/posts`: Get all posts in a subreddit
- `POST /subreddits/:id/posts`: Create a new post in a subreddit

Users

- `GET /users/:id/profile`: Get user profile information
- `GET /users/:id/subscriptions`: Get user's subscribed subreddits

Posts

- `POST /posts/:id/upvote`: Upvote a post
- `POST /posts/:id/comments`: Add a comment to a post
- `GET /posts/:id/comments`: Get all comments on a post

Subscriptions

- `POST /subscriptions`: Subscribe to a subreddit

## Getting Started

Clone the project

```bash
  git clone <repository-url>
```

Go to the project directory

```bash
  cd reddit-api-clone
```

Install dependencies

```bash
  npm install
```

Start the server

```bash
  node server.js
```

### Future Improvements

Potential enhancements could include:

- Authentication system
- Post categories and tags
- Search functionality
- Downvoting system
- Media upload support
