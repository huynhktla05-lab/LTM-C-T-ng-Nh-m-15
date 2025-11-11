using System;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Drawing;
using System.Text;

namespace Board
{
    class Boad_Game
    {
        public struct FlagPoint   
        {
            public int Row;
            public int Column;
            public string Order;
            public bool isEmpty;    
            public string Name;    
            public int Party;   
            public PictureBox CanMove;  
        }
        public static FlagPoint[,] Position = new FlagPoint[10, 9];    
        static Boad_Game()  
        {
            for (int i = 0; i <= 9; i++)
            {
                for (int j = 0; j <= 8; j++)
                {
                    Position[i, j].Row = i;
                    Position[i, j].Column = j;
                    Position[i, j].isEmpty = true;
                    Position[i, j].Name = "";
                    Position[i, j].Order = "";
                    Position[i, j].Party = 0;
                    Position[i, j].CanMove = new PictureBox();
                    Position[i, j].CanMove.Image = Board.Properties.Resources.CanMove;
                    Position[i, j].CanMove.Width = 28;
                    Position[i, j].CanMove.Height = 28;
                    Position[i, j].CanMove.BackColor = Color.Transparent;
                    Position[i, j].CanMove.Top = i * 53 + 87;
                    Position[i, j].CanMove.Left = j * 53 + 68;
                    Position[i, j].CanMove.Cursor = Cursors.Hand;
                    Position[i, j].CanMove.Visible = false;  
                }
            }
        }       
        public static void ResetCanMove()
        {
            for (int i = 0; i <= 9; i++)
            {
                for (int j = 0; j <= 8; j++)
                {
                    Boad_Game.Position[i, j].CanMove.Visible = false;
                }
            }
        }
        public static void ResetBoard_Game()
        {
            for (int i = 0; i <= 9; i++)
            {
                for (int j = 0; j <= 8; j++)
                {
                    Position[i, j].Row = i;
                    Position[i, j].Column = j;
                    Position[i, j].isEmpty = true;
                    Position[i, j].Name = "";
                    Position[i, j].Order = "";
                    Position[i, j].Party = 0;
                    Position[i, j].CanMove.Visible = false;  
                }
            }
        }
        private void CanMove_MouseClick(Object sender, MouseEventArgs e)
        {
           
        }
    }
}
