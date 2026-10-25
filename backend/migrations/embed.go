// Package migrations embeds the SQL migrations so the API binary can apply them on start (`API_MIGRATE=true`) or via `api migrate`.
package migrations

import "embed"

//go:embed *.up.sql
var FS embed.FS
