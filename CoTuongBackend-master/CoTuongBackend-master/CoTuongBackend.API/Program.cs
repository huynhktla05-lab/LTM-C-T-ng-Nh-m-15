using CoTuongBackend.API;
using CoTuongBackend.API.Hubs;
using CoTuongBackend.Application;
using CoTuongBackend.Infrastructure;
using CoTuongBackend.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// -------------------- Add Services --------------------

// CORS policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://192.168.1.42:3000") // frontend local
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddAPIServices();
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

// -------------------- Build App --------------------
var app = builder.Build();

// -------------------- Swagger --------------------
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.EnableDeepLinking();
    options.EnableFilter();
    options.EnableValidator();
    options.EnableTryItOutByDefault();
    options.EnablePersistAuthorization();
});

// -------------------- Seed DB in Development --------------------
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var initialiser = scope.ServiceProvider.GetRequiredService<ApplicationDbContextInitializer>();
    await initialiser.InitialiseAsync();
    await initialiser.SeedAsync();
}

// -------------------- HTTPS (only in Production) --------------------
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// -------------------- Middleware --------------------
app.UseCors("AllowFrontend"); // Must be before UseAuthorization
app.UseAuthorization();

// -------------------- Controllers --------------------
app.MapControllers();

// Redirect root to Swagger
app.MapGet("", () => Results.Redirect("/swagger"))
    .ExcludeFromDescription();

// -------------------- SignalR --------------------
app.MapHub<GameHub>("hubs/game");

// -------------------- Run --------------------
app.Run();
