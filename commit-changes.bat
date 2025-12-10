@echo off
echo ====================================
echo Committing MoeTasker v2.0 Changes
echo ====================================
echo.

REM Add all new and modified files
echo Adding files to git...
git add .

echo.
echo Files staged:
git status --short

echo.
echo Creating commit...
git commit -m "feat: MoeTasker v2.0 - Multi-team support with AI Command Awareness

Major changes:
- Migrated from Groq to Cerebras AI (gpt-oss-120b)
- Added multi-team/multi-group support
- Implemented dynamic member management system
- Added AI Command Awareness (intent detection)
- New commands: /addMember, /removeMember, /listMembers, /memberInfo, /updateMember, /teamStats
- Updated task commands with multi-group support
- Added command registry and handler system
- Database schema updated with chat_id support
- All commands now support English + Spanish aliases
- Enhanced system initialization and migrations
- Added comprehensive documentation (MIGRATION_GUIDE.md, TODO.md, STATUS.md)

Breaking changes:
- Removed hardcoded team members
- Environment variables changed (CEREBRAS_API_KEY replaces GROQ_API_KEY)
- Service functions now require chatId parameter
- Database migration required

New files:
- lib/services/memberService.js
- lib/services/commandRegistry.js
- lib/services/initDatabase.js
- lib/commands/memberCommands.js
- lib/commands/taskCommands.js
- lib/commands/registerCommands.js
- lib/middleware/commandHandler.js
- scripts/initSystem.js
- MIGRATION_GUIDE.md, TODO.md, STATUS.md, CHANGELOG.md
- .env.example

Updated files:
- pages/api/chat.js (Cerebras integration, chatId support)
- pages/api/webhook.js (command system integration)
- lib/services/taskManager.js (multi-group support)
- package.json (new dependencies and scripts)
"

echo.
echo Pushing to GitHub...
git push origin master

echo.
echo ====================================
echo Done! Check Vercel for deployment
echo ====================================
pause
