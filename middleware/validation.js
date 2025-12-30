/**
 * バリデーションミドルウェア
 */

/**
 * 動画予定のバリデーション
 */
function validateVideoPlan(req, res, next) {
  const { no, type, title, intro_content, narration_content, tags, category } = req.body;
  const errors = [];

  if (no !== undefined) {
    const num = parseInt(no, 10);
    if (isNaN(num) || num < 0 || num > 999999) {
      errors.push('Noは0以上999999以下の数値である必要があります');
    }
  }

  if (type && !['動画', 'ショート'].includes(type)) {
    errors.push('種類は「動画」または「ショート」である必要があります');
  }

  if (title !== undefined) {
    if (typeof title !== 'string') {
      errors.push('タイトルは文字列である必要があります');
    } else if (title.length > 500) {
      errors.push('タイトルは500文字以内で入力してください');
    }
  }

  if (intro_content !== undefined && intro_content.length > 10000) {
    errors.push('冒頭内容は10000文字以内で入力してください');
  }

  if (narration_content !== undefined && narration_content.length > 10000) {
    errors.push('ナレーション内容は10000文字以内で入力してください');
  }

  if (tags !== undefined && tags.length > 500) {
    errors.push('タグは500文字以内で入力してください');
  }

  if (category !== undefined && category.length > 100) {
    errors.push('カテゴリーは100文字以内で入力してください');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
}

/**
 * 投稿済み動画のバリデーション
 */
function validatePostedVideo(req, res, next) {
  const { no, type, title, view_count, like_count } = req.body;
  const errors = [];

  if (no !== undefined) {
    const num = parseInt(no, 10);
    if (isNaN(num) || num < 0 || num > 999999) {
      errors.push('Noは0以上999999以下の数値である必要があります');
    }
  }

  if (type && !['動画', 'ショート'].includes(type)) {
    errors.push('種類は「動画」または「ショート」である必要があります');
  }

  if (title !== undefined) {
    if (typeof title !== 'string') {
      errors.push('タイトルは文字列である必要があります');
    } else if (title.length > 500) {
      errors.push('タイトルは500文字以内で入力してください');
    }
  }

  if (view_count !== undefined) {
    const num = parseInt(view_count, 10);
    if (isNaN(num) || num < 0 || num > 999999999) {
      errors.push('視聴回数は0以上999999999以下の数値である必要があります');
    }
  }

  if (like_count !== undefined) {
    const num = parseInt(like_count, 10);
    if (isNaN(num) || num < 0 || num > 999999999) {
      errors.push('いいね数は0以上999999999以下の数値である必要があります');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
}

module.exports = {
  validateVideoPlan,
  validatePostedVideo
};

