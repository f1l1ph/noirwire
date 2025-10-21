# NoirWire API - Railway Deployment Makefile

.PHONY: help deploy railway-login railway-link railway-vars railway-deploy railway-logs railway-status

help: ## Show this help message
	@echo "NoirWire API - Railway Deployment Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

railway-login: ## Login to Railway
	@echo "🔐 Logging into Railway..."
	@railway login --browserless

railway-link: ## Link Railway project (API only, not monorepo root)
	@echo "🔗 Linking Railway project to API directory..."
	@railway link

railway-vars: ## Set Railway environment variables
	@echo "🔧 Setting Railway environment variables from config.json..."
	@echo ""
	@node scripts/set-railway-vars.js
	@echo ""
	@echo "⚠️  IMPORTANT: You still need to set these variables manually in Railway dashboard:"
	@echo "   - SUPABASE_URL (your Supabase project URL)"
	@echo "   - SUPABASE_SERVICE_KEY (your Supabase service role key)"
	@echo "   - CORS_ORIGINS (add your Vercel URL after frontend deployment)"
	@echo ""
	@echo "📊 Go to: https://railway.com/dashboard"
	@echo "   → Click your project → Variables tab"
	@echo ""
	@echo "✅ Basic variables set! Railway will auto-redeploy once you add the missing ones."

railway-deploy: ## Deploy to Railway (from API directory)
	@echo "🚀 Deploying to Railway..."
	@echo "Note: Railway builds from monorepo root but deployment is managed from here"
	@railway up --detach
	@echo ""
	@echo "✅ Deployment started!"
	@echo "📊 Check status: https://railway.com/dashboard"

railway-logs: ## View Railway logs
	@echo "📋 Fetching Railway logs..."
	@railway logs

railway-status: ## Check Railway deployment status
	@echo "📊 Railway Status:"
	@railway status

deploy: railway-deploy ## Alias for railway-deploy

# Quick deployment workflow
quick-deploy: ## Full deployment workflow (login → link → vars → deploy)
	@echo "🚀 Starting full Railway deployment..."
	@echo ""
	@make railway-login
	@make railway-link
	@make railway-vars
	@make railway-deploy
	@echo ""
	@echo "🎉 Deployment complete!"
	@echo "⚠️  Don't forget to set SUPABASE_URL and SUPABASE_SERVICE_KEY in Railway dashboard"
