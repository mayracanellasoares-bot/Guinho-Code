SELECT id, name, score
FROM players
ORDER BY score DESC, id ASC
LIMIT ?;
