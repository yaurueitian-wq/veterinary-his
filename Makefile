.PHONY: up down logs build migrate shell-db shell-backend setup

# 啟動所有服務
up:
	docker compose up -d

# 停止所有服務
down:
	docker compose down

# 即時 log
logs:
	docker compose logs -f

# 重建 image
build:
	docker compose build

# 執行資料庫 migration（需先啟動服務）
migrate:
	docker compose exec backend alembic upgrade head

# 回退最後一次 migration
migrate-down:
	docker compose exec backend alembic downgrade -1

# 查看 migration 狀態
migrate-status:
	docker compose exec backend alembic current

# 連接資料庫 shell
shell-db:
	docker compose exec db psql -U $${POSTGRES_USER:-his_user} -d $${POSTGRES_DB:-his}

# 連接 backend shell
shell-backend:
	docker compose exec backend bash

# 首次初始化（複製 .env → 啟動 → migration）
setup:
	@test -f .env || (cp .env.example .env && echo "已複製 .env.example → .env，請修改 POSTGRES_PASSWORD 和 SECRET_KEY 後重新執行 make setup")
	@test -f .env && docker compose up -d && sleep 5 && docker compose exec backend alembic upgrade head && echo "✓ 初始化完成"
