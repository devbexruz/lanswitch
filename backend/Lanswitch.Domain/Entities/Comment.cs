using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Comment : BaseEntity
{
    public long MediaId { get; set; }
    public long UserId { get; set; }
    public string Text { get; set; } = null!;
    public long? ParentCommentId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Media? Media { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Comment? ParentComment { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Comment> Replies { get; set; } = new List<Comment>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<CommentLike> Likes { get; set; } = new List<CommentLike>();
}
