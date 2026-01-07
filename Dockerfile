# ---- Dependencies stage ----
    FROM node:18-alpine AS deps
    WORKDIR /app
    
    # Install dependencies based on lockfile
    COPY package.json yarn.lock ./
    RUN yarn install --frozen-lockfile
    
    # ---- Build stage ----
    FROM node:18-alpine AS builder
    WORKDIR /app
    
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    RUN yarn build
    
    # ---- Production stage ----
    FROM node:18-alpine AS runner
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=8080
    
    # Copy only necessary files
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/.next ./.next
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json
    
    EXPOSE 8080
    
    CMD ["yarn", "start"]